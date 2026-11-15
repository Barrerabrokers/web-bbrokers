import { createCrmActivity } from '@/lib/db';
import { registerScheduledMeeting } from '@/lib/crm-meeting-lifecycle';
import type { MeetingState } from '@/lib/mia-meeting-policy';

// Idempotent by Google's event ID. Retried independently of the WhatsApp turn.
export async function syncMiaMeetingToCrm(state: MeetingState, leadId: string) {
  if (!state.eventId || !state.selected || !state.organizerId || state.phase !== 'booked') throw Error('Unverified meeting');
  const result = await createCrmActivity({leadId, type:'reunion', title:`Reunión con ${state.organizerName || 'un agente comercial'}`,
    body:`Coordinada por MIA. ${state.mode === 'google_meet' ? 'Virtual por Google Meet.' : state.mode === 'phone' ? 'Llamada al cliente.' : 'Reunión presencial.'}\n${state.meetUrl || ''}\n${state.email ? 'Invitación por correo solicitada a Google Calendar.' : ''}`,
    scheduledAt:state.selected.start, createdBy:state.organizerId, externalSource:'google_calendar', externalId:state.eventId,
    duration:Math.round((Date.parse(state.selected.end)-Date.parse(state.selected.start))/60000)});
  if (!result.activity) throw Error('CRM meeting persistence pending');
  await registerScheduledMeeting(result.activity.id,state.selected.end,state.organizerId,true);
  return {...state,activityId:result.activity.id,crmSyncedAt:new Date().toISOString()};
}
