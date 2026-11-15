import { createHash } from 'crypto';
import { z } from 'zod';
import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
import { acquireWorkerLease, releaseWorkerLease } from '@/lib/database-worker-lease';
import { getMiaMeetingConfig, miaMeetingCalendar, createMiaGoogleMeeting, ensureMiaMeetingSchema } from '@/lib/mia-meetings';
import { syncMiaMeetingToCrm } from '@/lib/mia-meeting-reconciliation';
import { getBookedRanges } from '@/lib/meeting-scheduler';
import { overlaps, type MeetingState } from '@/lib/mia-meeting-policy';

const requestSchema=z.object({conversationId:z.string().uuid(),sessionId:z.string().uuid(),approvedBy:z.string().uuid(),organizerId:z.string().uuid(),start:z.string().datetime(),end:z.string().datetime(),email:z.string().email(),approvedAt:z.string().datetime(),allowOutsideHours:z.literal(true),status:z.enum(['pending','complete']),eventId:z.string().optional(),lastError:z.string().optional()});
export function matchingRecoveryEvent(event:any,state:MeetingState) {
 return event.status!=='cancelled' && Date.parse(event.start?.dateTime)===Date.parse(state.selected!.start) && Date.parse(event.end?.dateTime)===Date.parse(state.selected!.end) && (state.email ? event.attendees?.some((a:any)=>a.email?.toLowerCase()===state.email?.toLowerCase()) : event.extendedProperties?.private?.miaBooking===state.id);
}
async function google(token:string,path:string,init:RequestInit={}) {
 const r=await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events'+path,{...init,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(20000)});
 if(r.status===404)return null;
 if(!r.ok)throw Error(`calendar_http_${r.status}`);
 return r.json();
}
export async function processMiaMeetingRecovery() {
 await ensureMiaMeetingSchema();const sql=getSharedDatabase();let lease:string|null=null;let completed=0,pending=0;
 try {
  lease=await acquireWorkerLease(sql,'mia-pablo-meeting-calendar');if(!lease)return {completed,pending,busy:true};
  const config=await getMiaMeetingConfig();if(!config)return {completed,pending};
  // Requests are written only by an authenticated administrator, never extracted from chat text.
  const requests=await sql`SELECT key,value FROM crm_whatsapp_agent_settings WHERE key LIKE 'mia-meeting-admin-recovery-v1:%' AND value::jsonb->>'status'='pending' ORDER BY updated_at LIMIT 5`;
  for(const row of requests){let request:any;
   try {
    request=requestSchema.parse(JSON.parse(row.value));
    const [admin]=await sql`SELECT id FROM agents WHERE id=${request.approvedBy} AND role='admin' AND active=TRUE`;
    const [organizer]=await sql`SELECT id,name,email FROM agents WHERE id=${request.organizerId} AND role='admin' AND active=TRUE`;
    const [stored]=await sql`SELECT m.state,m.version,c.lead_id,l.email FROM crm_mia_meeting_sessions m JOIN crm_whatsapp_conversations c ON c.id=m.conversation_id JOIN crm_leads l ON l.id=c.lead_id WHERE m.conversation_id=${request.conversationId}`;
    if(!admin||!organizer||!stored||stored.state.id!==request.sessionId||stored.email?.toLowerCase()!==request.email.toLowerCase()||stored.state.selected?.start!==request.start||stored.state.selected?.end!==request.end||!['confirm','creating','booked','pendiente_admin'].includes(stored.state.phase)||stored.state.changeRequest)throw Error('recovery_identity_changed');
    if(Date.parse(request.start)<=Date.now()||Date.parse(request.end)-Date.parse(request.start)!==3600000)throw Error('recovery_time_invalid');
    let state:MeetingState={...stored.state,organizerId:organizer.id,organizerName:organizer.name,organizerEmail:organizer.email};let version=Number(stored.version);
    const save=async()=>{const rows=await sql`UPDATE crm_mia_meeting_sessions SET state=${sql.json(state as any)},version=version+1,updated_at=NOW() WHERE conversation_id=${request.conversationId} AND version=${version} RETURNING version`;if(!rows.length)throw Error('recovery_conversation_changed');version=Number(rows[0].version);};
    const c={...config,organizerId:organizer.id};const token=await miaMeetingCalendar(c);
    let event=state.eventId?await google(token,'/'+encodeURIComponent(state.eventId)):null;
    if(event&&!matchingRecoveryEvent(event,state))throw Error('recovery_event_changed');
    if(!event){
     const events:any[]=[];let page='';do{const q=new URLSearchParams({timeMin:request.start,timeMax:request.end,singleEvents:'true',maxResults:'2500'});if(page)q.set('pageToken',page);const data=await google(token,'?'+q);events.push(...(data?.items||[]));page=data?.nextPageToken||'';}while(page);
     const matches=events.filter(e=>matchingRecoveryEvent(e,state));if(matches.length>1)throw Error('multiple_existing_meetings');
     event=matches[0];
     if(!event){
      if(events.some(e=>e.status!=='cancelled'&&e.transparency!=='transparent'&&!e.attendees?.some((a:any)=>a.self&&a.responseStatus==='declined')))throw Error('calendar_slot_busy');
      const booked=await getBookedRanges(organizer.id,new Date(request.start),new Date(request.end));
      if(overlaps(state.selected!,booked.map((b:any)=>({start:new Date(b.starts_at).toISOString(),end:new Date(b.ends_at).toISOString()}))))throw Error('crm_slot_busy');
      state={...state,phase:'creating',eventId:state.eventId||createHash('sha256').update('mia-meeting:'+state.id).digest('hex')};await save();
      event=await createMiaGoogleMeeting(token,state,c);
     } else {
      // Reuse an exact existing booking instead of creating a duplicate. Request participant updates once.
      event=await google(token,'/'+encodeURIComponent(event.id)+'?sendUpdates=all&conferenceDataVersion=1',{method:'PATCH',body:JSON.stringify({attendees:event.attendees,conferenceData:event.hangoutLink?undefined:{createRequest:{requestId:createHash('sha256').update(state.id).digest('hex'),conferenceSolutionKey:{type:'hangoutsMeet'}}}})});
     }
    }
    if(!event?.id||!matchingRecoveryEvent(event,state))throw Error('calendar_confirmation_invalid');
    const meet=event.hangoutLink||event.conferenceData?.entryPoints?.find((p:any)=>p.entryPointType==='video')?.uri;
    state={...state,eventId:event.id,phase:'booked',conversationState:'reunion_cerrada',meetUrl:meet||state.meetUrl,updatedAt:new Date().toISOString()};await save();
    state=await syncMiaMeetingToCrm(state,stored.lead_id);await save();
    request={...request,status:'complete',eventId:event.id,lastError:undefined};completed++;
   }catch(error){pending++;if(request)request={...request,lastError:error instanceof Error&&/^(calendar_http_|recovery_|calendar_slot_busy|crm_slot_busy|multiple_existing_meetings|calendar_confirmation_invalid)/.test(error.message)?error.message:'calendar_or_crm_connection_pending'};}
   if(request)await sql`UPDATE crm_whatsapp_agent_settings SET value=${JSON.stringify(request)},updated_at=NOW() WHERE key=${row.key}`;
  }
  // Repair the CRM leg of all future Calendar-confirmed bookings without sending another invitation.
  const sessions=await sql`SELECT m.conversation_id,m.version,m.state,c.lead_id FROM crm_mia_meeting_sessions m JOIN crm_whatsapp_conversations c ON c.id=m.conversation_id WHERE m.state->>'phase'='booked' AND m.state->>'crmSyncedAt' IS NULL AND (m.state->'selected'->>'start')::timestamptz>NOW() AND c.lead_id IS NOT NULL LIMIT 20`;
  for(const r of sessions){try{if(!r.state.organizerId||!r.state.eventId)continue;const token=await miaMeetingCalendar({...config,organizerId:r.state.organizerId});const event=await google(token,'/'+encodeURIComponent(r.state.eventId));if(!event||!matchingRecoveryEvent(event,r.state))continue;const state=await syncMiaMeetingToCrm(r.state,r.lead_id);await sql`UPDATE crm_mia_meeting_sessions SET state=${sql.json(state as any)},version=version+1,updated_at=NOW() WHERE conversation_id=${r.conversation_id} AND version=${r.version}`;completed++;}catch{pending++;}}
  return {completed,pending};
 }finally{if(lease)await releaseWorkerLease(sql,'mia-pablo-meeting-calendar',lease);await releaseSharedDatabase(sql);}
}
