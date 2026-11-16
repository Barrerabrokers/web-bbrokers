import { MEET_EMAIL_NOTICE } from './meeting-links';
import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
import type { MeetingConfig, MeetingState } from '@/lib/mia-meeting-policy';

export async function recordConfirmedMiaMeeting(state: MeetingState, config: MeetingConfig, leadId: string, phone: string) {
  const {selected, eventId, organizerName, mode} = state;
  if (!selected || !eventId || !organizerName || !mode) {
    throw new Error('Incomplete confirmed meeting');
  }
  const whatsapp = phone.replace(/\D/g, '');
  if (!whatsapp) throw new Error('Missing WhatsApp number');
  const location = state.mode === 'google_meet' ? state.meetUrl ?? MEET_EMAIL_NOTICE : state.mode === 'in_person' ? config.location : phone;
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

export async function readMiaMeetingStatus(conversationId: string, eventId?: string) {
  const sql = getSharedDatabase();
  try {
    const [row] = await sql`
      select m.estado, m.agente,
        to_char(m.dia, 'YYYY-MM-DD') as day, to_char(m.hora, 'HH24:MI') as time
      from public.mia_meetings m
      join public.mia_clients c on c.id = m.client_id
      join public.crm_whatsapp_conversations w on w.id = ${conversationId}
      where (${eventId ?? ''} <> '' and m.google_event_id = ${eventId ?? ''})
        or (${eventId ?? ''} = '' and c.crm_lead_id = w.lead_id)
      order by m.dia desc, m.hora desc limit 1`;
    return row;
  } finally {
    await releaseSharedDatabase(sql);
  }
}

export async function commitMiaReschedule(
  sql: ReturnType<typeof getSharedDatabase>, conversationId: string, version: number,
  state: MeetingState, leadId: string,
) {
  const { eventId, selected, meetUrl } = state;
  if (!eventId || !selected) throw new Error('Incomplete reschedule');

  await sql.begin(async tx => {
    const [meeting] = await tx`
      update public.mia_meetings set
        dia = (${selected.start}::timestamptz at time zone 'America/Argentina/Buenos_Aires')::date,
        hora = (${selected.start}::timestamptz at time zone 'America/Argentina/Buenos_Aires')::time,
        estado = 'reprogramada', lugar_link = ${meetUrl ?? MEET_EMAIL_NOTICE}
      where google_event_id = ${eventId} and estado in ('confirmada', 'reprogramada')
        and client_id in (select id from public.mia_clients where crm_lead_id = ${leadId})
      returning id, client_id`;
    if (!meeting) throw new Error('Missing scheduled meeting');

    await tx`
      update public.mia_reminders set estado = 'cancelado'
      where meeting_id = ${meeting.id} and estado <> 'cancelado'`;
    await tx`
      insert into public.mia_reminders (meeting_id, tipo, canal, programado_en)
      values
        (${meeting.id}, '1_dia_antes', 'whatsapp+mail', ${selected.start}::timestamptz - interval '1 day'),
        (${meeting.id}, '1_hora_antes', 'whatsapp+mail', ${selected.start}::timestamptz - interval '1 hour')`;

    const [activity] = await tx`
      update public.crm_activities set scheduled_at = ${selected.start}
      where lead_id = ${leadId} and external_source = 'google_calendar' and external_id = ${eventId}
      returning id`;
    if (!activity) throw new Error('Missing CRM activity');
    const schedules = await tx`
      update public.crm_meeting_schedules set ends_at = ${selected.end}
      where activity_id = ${activity.id} and cancelled_at is null returning activity_id`;
    if (!schedules.length) throw new Error('Missing CRM schedule');
    await tx`update public.crm_leads set status = 'Reunion', updated_at = now() where id = ${leadId}`;
    await tx`
      update public.mia_clients set etapa_crm = 'reunion', proximo_paso = 'reunion_cerrada', updated_at = now()
      where id = ${meeting.client_id}`;

    const updated = await tx`
      update public.crm_mia_meeting_sessions set state = ${tx.json(state)}, version = version + 1, updated_at = now()
      where conversation_id = ${conversationId} and version = ${version} returning version`;
    if (!updated.length) throw new Error('Stale reschedule');
  });
}
