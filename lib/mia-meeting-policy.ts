import { z } from 'zod';
export const MIA_MEETING_ZONE='America/Argentina/Buenos_Aires';
export const meetingConfigSchema=z.object({enabled:z.boolean(),organizerId:z.string().uuid(),organizerIds:z.array(z.string().uuid()).min(1).max(2).optional(),location:z.string().trim().min(5).max(160),weekdays:z.array(z.number().int().min(0).max(6)).min(1),startTime:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),endTime:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),duration:z.union([z.literal(30),z.literal(60)]),leadMinutes:z.number().int().min(5).max(1440).default(60)}).refine(c=>c.startTime>= '08:00'&&c.endTime<='21:00'&&c.startTime<c.endTime&&Number(c.startTime.slice(3))%30===0&&Number(c.endTime.slice(3))%30===0&&!/^a definir$/i.test(c.location));
export type MeetingConfig=z.infer<typeof meetingConfigSchema>;
export type Slot={start:string;end:string};
export type Mode='in_person'|'google_meet'|'phone';
export const meetingTurnSchema=z.object({intent:z.enum(['start','availability','select','cancel','other']),mode:z.enum(['in_person','google_meet','phone']).nullable(),choice:z.union([z.literal(1),z.literal(2)]).nullable(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),weekdays:z.array(z.number().int().min(0).max(6)),period:z.enum(['morning','afternoon','any']),time:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable(),name:z.string().trim().max(120).nullable(),email:z.string().email().max(254).nullable()});
export type MeetingTurn=z.infer<typeof meetingTurnSchema>;
export type MeetingChangeRequest={kind:'cancel'|'reschedule';text:string;requestedAt:string;offers:Slot[];selected?:Slot};
export type MeetingConversationState='sin_reunion'|'proponiendo_horario'|'esperando_confirmacion'|'reunion_confirmada'|'reunion_cerrada';
export type MeetingState={crmSyncedAt?:string;organizerId?:string;organizerName?:string;organizerEmail?:string;adminRequest?:string;conversationState?:MeetingConversationState;confirmationKey?:string;reminderRequested?:boolean;timeWindow?:{start:string;end:string};changeRequest?:MeetingChangeRequest;id:string;phase:'offered'|'details'|'confirm'|'creating'|'review'|'booked'|'cancelled'|'pendiente_admin';offers:Slot[];selected?:Slot;mode?:Mode;name?:string;email?:string;phone?:string;updatedAt:string;eventId?:string;meetUrl?:string;activityId?:string};
export function meetingIntent(text:string){return /agend|coordinar|coordinemos|reuni[oó]n|reunir|\bcita\b|visita|llamada|llamame|ll[aá]menme|llamarme|videollamada|google meet|virtual|presencial|zoom|vernos|juntarnos|showroom/i.test(text);}
export function explicitlyConfirmsMeeting(text:string){
 const value=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[.,!¿?]/g,' ').replace(/\bx favor\b/g,'por favor').replace(/\s+/g,' ').trim();
 return /^(?:si|confirmo|confirmado|confirmada|dale|ok|okay|de acuerdo|perfecto|agenda|agendala|agendalo|reserva|reservala)(?: (?:confirmo|confirma|dale|por favor|perfecto|correcto|esta bien|adelante|agenda|agendala|agendalo|la reunion|ese horario))*$/.test(value);
}
export function argentinaDay(date:Date){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:MIA_MEETING_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);return ['year','month','day'].map(type=>parts.find(p=>p.type===type)!.value).join('-');}
export function slotLabel(slot:Slot){return new Intl.DateTimeFormat('es-AR',{timeZone:MIA_MEETING_ZONE,weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(slot.start));}
export function allowedMeetingSlot(slot:Slot,c:MeetingConfig,now=new Date()){
 const date=new Date(slot.start),end=new Date(slot.end),day=argentinaDay(date),weekday=new Date(day+'T12:00:00-03:00').getUTCDay();
 const time=new Intl.DateTimeFormat('en-GB',{timeZone:MIA_MEETING_ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
 return Number.isFinite(date.getTime())&&date.getTime()>=now.getTime()+c.leadMinutes*60000&&date.getTime()<=now.getTime()+31*86400000&&c.weekdays.includes(weekday)&&time>=c.startTime&&time<c.endTime&&date.getUTCSeconds()===0&&date.getUTCMilliseconds()===0&&date.getUTCMinutes()%30===0&&end.getTime()-date.getTime()===c.duration*60000&&end<=new Date(day+'T'+c.endTime+':00-03:00');
}
export const overlaps=(slot:Slot,busy:Slot[])=>busy.some(b=>new Date(slot.start)<new Date(b.end)&&new Date(slot.end)>new Date(b.start));
export function proposeMeetingSlots(c:MeetingConfig,busy:Slot[],preference:Pick<MeetingTurn,'date'|'weekdays'|'period'|'time'>&{timeWindow?:{start:string;end:string}},now=new Date()):Slot[]{
 const first=preference.date||argentinaDay(new Date(now.getTime()+86400000));
 if(!Number.isFinite(new Date(first+'T12:00:00-03:00').getTime())||argentinaDay(new Date(first+'T12:00:00-03:00'))!==first)return [];
 const candidates:Slot[]=[];
 for(let d=0;d<(preference.date?1:14);d++){
  const day=argentinaDay(new Date(new Date(first+'T12:00:00-03:00').getTime()+d*86400000));
  const weekday=new Date(day+'T12:00:00-03:00').getUTCDay();if(preference.weekdays.length&&!preference.weekdays.includes(weekday))continue;
  for(let m=8*60;m<21*60;m+=30){
   const time=String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
   if(preference.timeWindow&&(time<preference.timeWindow.start||m+c.duration>Number(preference.timeWindow.end.slice(0,2))*60+Number(preference.timeWindow.end.slice(3))))continue;
   if(preference.time&&time!==preference.time||preference.period==='morning'&&m>=12*60||preference.period==='afternoon'&&m<12*60)continue;
   const start=new Date(day+'T'+time+':00-03:00');const slot={start:start.toISOString(),end:new Date(start.getTime()+c.duration*60000).toISOString()};
   if(allowedMeetingSlot(slot,c,now)&&!overlaps(slot,busy))candidates.push(slot);
  }
 }
 // Prefer the requested sales slots tomorrow, only when both are actually available.
 const tomorrow=argentinaDay(new Date(now.getTime()+86400000));
 const preferred=['16:00','17:30'].map(time=>candidates.find(s=>s.start===new Date(tomorrow+'T'+time+':00-03:00').toISOString()));
 if(preferred.every((s):s is Slot=>!!s))return preferred;
 // Prefer two different days and vary morning/afternoon; all alternatives remain actually free.
 const score=(s:Slot,target:number)=>Math.abs(new Date(s.start).getUTCHours()*60+new Date(s.start).getUTCMinutes()-180-target);
 const day=candidates[0]?.start.slice(0,10);if(!day)return [];
 const a=candidates.filter(s=>s.start.startsWith(day)).sort((a,b)=>score(a,16*60)-score(b,16*60))[0];
 const others=candidates.filter(s=>s.start.slice(0,10)!==day);const nextDay=others[0]?.start.slice(0,10);
 const b=nextDay?others.filter(s=>s.start.startsWith(nextDay)).sort((a,b)=>score(a,10*60)-score(b,10*60))[0]:candidates.find(s=>s.start!==a.start);
 return b?[a,b]:[a];
}
export function meetingSummary(state:MeetingState,c:MeetingConfig){return `${slotLabel(state.selected!)} (hora de Argentina), ${c.duration} minutos, ${state.mode==='phone'?'por teléfono':state.mode==='google_meet'?'virtual por Google Meet':`presencial en ${c.location}`}`;}

export const meetingStateSchema=z.object({crmSyncedAt:z.string().datetime().optional(),organizerId:z.string().uuid().optional(),organizerName:z.string().max(120).optional(),organizerEmail:z.string().email().optional(),adminRequest:z.string().max(1000).optional(),conversationState:z.enum(['sin_reunion','proponiendo_horario','esperando_confirmacion','reunion_confirmada','reunion_cerrada']).optional(),confirmationKey:z.string().optional(),reminderRequested:z.boolean().optional(),timeWindow:z.object({start:z.string(),end:z.string()}).optional(),changeRequest:z.object({kind:z.enum(['cancel','reschedule']),text:z.string().max(1000),requestedAt:z.string().datetime(),offers:z.array(z.object({start:z.string().datetime(),end:z.string().datetime()})).max(2),selected:z.object({start:z.string().datetime(),end:z.string().datetime()}).optional()}).optional(),id:z.string().uuid(),phase:z.enum(['offered','details','confirm','creating','review','booked','cancelled','pendiente_admin']),offers:z.array(z.object({start:z.string().datetime(),end:z.string().datetime()})).max(2),selected:z.object({start:z.string().datetime(),end:z.string().datetime()}).optional(),mode:z.enum(['in_person','google_meet','phone']).optional(),name:z.string().max(120).optional(),email:z.string().email().optional(),phone:z.string().max(40).optional(),updatedAt:z.string().datetime(),eventId:z.string().max(64).optional(),meetUrl:z.string().url().optional(),activityId:z.string().uuid().optional()});

/** Customer clock constraints override an extractor's inferred slot selection. */
export function explicitMeetingClock(text:string){
 const window=text.match(/entre\s+(\d{1,2})(?::(\d{2}))?\s*(?:hs?|horas)?\s*(?:y|a|-)\s*(\d{1,2})(?::(\d{2}))?/i);
 const clock=(h:string,m='00')=>Number(h)<24&&Number(m)<60?h.padStart(2,'0')+':'+m:null;
 if(window){const start=clock(window[1],window[2]),end=clock(window[3],window[4]);if(start&&end&&start<end)return {time:null,timeWindow:{start,end}};}
 const exact=text.match(/\b(\d{1,2}):(\d{2})\b/);
 if(exact){const time=clock(exact[1],exact[2]);if(time)return {time,timeWindow:undefined};}
 return null;
}
export function meetingRestart(text:string){return /empecemos de nuevo|empezar de nuevo|arranquemos de nuevo|comencemos de nuevo/i.test(text);}
export function meetingConversationState(state:MeetingState):MeetingConversationState{
 if(state.conversationState==='reunion_cerrada')return 'reunion_cerrada';
 return state.phase==='booked'?'reunion_confirmada':state.phase==='cancelled'?'sin_reunion':['confirm','creating','review','pendiente_admin'].includes(state.phase)?'esperando_confirmacion':'proponiendo_horario';
}
