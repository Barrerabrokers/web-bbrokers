import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
import type { MeetingConfig, MeetingState } from '@/lib/mia-meeting-policy';

export async function recordConfirmedMiaMeeting(state: MeetingState, config: MeetingConfig, leadId: string, phone: string) {
  const {selected, eventId, organizerName, mode} = state;
  if (!selected || !eventId || !organizerName || !mode) {
    throw new Error('Incomplete confirmed meeting');
  }
  const whatsapp = phone.replace(/\D/g, '');
  if (!whatsapp) throw new Error('Missing WhatsApp number');
  const location = state.mode === 'google_meet' ? state.meetUrl : state.mode === 'in_person' ? config.location : phone;
  if (!location) throw new Error('Missing confirmed meeting location');

  const sql = getSharedDatabase();
  try {
    await sql.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${whatsapp}, 0))`;
      const [existing] = await tx`
        select id from public.mia_clients
        where crm_lead_id = ${leadId} or whatsapp in (${whatsapp}, ${'+' + whatsapp})
        order by (crm_lead_id = ${leadId}) desc nulls last limit 1`;
      const [client] = existing ? [existing] : await tx`
        insert into public.mia_clients (crm_lead_id, whatsapp, nombre, email)
        values (${leadId}, ${whatsapp}, ${state.name ?? ''}, ${state.email ?? null})
        returning id`;
      await tx`
        update public.mia_clients set crm_lead_id = coalesce(crm_lead_id, ${leadId}),
          email = coalesce(nullif(${state.email ?? ''}, ''), email),
          updated_at = now()
        where id = ${client.id}`;
      await tx`
        insert into public.mia_meetings (client_id, agente, dia, hora, modalidad, estado, google_event_id, lugar_link)
        values (${client.id}, ${organizerName},
          (${selected.start}::timestamptz at time zone 'America/Argentina/Buenos_Aires')::date,
          (${selected.start}::timestamptz at time zone 'America/Argentina/Buenos_Aires')::time,
          ${mode}, 'confirmada', ${eventId}, ${location})
        on conflict (google_event_id) do nothing`;
    });
  } finally {
    await releaseSharedDatabase(sql);
  }
}

export async function markMiaMeetingClosed(eventId: string) {
  const sql = getSharedDatabase();
  try {
    await sql`
      update public.mia_clients c set etapa_crm='reunion', proximo_paso='reunion_cerrada', updated_at=now()
      from public.mia_meetings m where m.client_id=c.id and m.google_event_id=${eventId} and m.estado='confirmada'`;
  } finally {
    await releaseSharedDatabase(sql);
  }
}
