import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';

export async function readMiaMeetingHealth() {
  const sql = getSharedDatabase();
  try {
    const [counts] = await sql`
      with recent_messages as (
        select provider_message_id, direccion, texto
        from public.mia_messages m
        where coalesce(to_jsonb(m)->>'created_at', to_jsonb(m)->>'creado_en')::timestamptz >= now() - interval '1 day'
      ), recent_meetings as (
        select id, estado from public.mia_meetings m
        where coalesce(to_jsonb(m)->>'updated_at', to_jsonb(m)->>'created_at', to_jsonb(m)->>'creado_en')::timestamptz >= now() - interval '1 day'
          or (m.dia::text || ' ' || m.hora::text)::timestamp at time zone 'America/Argentina/Buenos_Aires' >= now()
      )
      select
        (select count(*)::int from recent_messages where direccion='inbound') as inbound,
        (select count(*)::int from recent_messages where direccion='outbound') as outbound,
        (select count(*)::int from (select provider_message_id from recent_messages where provider_message_id is not null
          group by provider_message_id having count(*)>1) duplicate) as duplicate_provider_ids,
        (select count(*)::int from recent_messages where direccion='outbound'
          and texto ~* '(ver archivo o enlace|queda solicitado|prefiero que un agente verifique ese dato|Mon Nov|GMT|UTC|[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2})') as flagged_outbound,
        (select count(*)::int from recent_meetings where estado='reprogramada') as rescheduled,
        (select count(*)::int from public.crm_mia_meeting_sessions
          where state->'changeRequest'->>'moving'='true') as reschedules_pending,
        (select count(*)::int from recent_meetings m where estado in ('confirmada','reprogramada')
          and (select count(*) from public.mia_reminders r where r.meeting_id=m.id
            and r.tipo in ('1_dia_antes','1_hora_antes') and r.estado <> 'cancelado') <> 2) as unexpected_reminder_count,
        (select count(*)::int from public.mia_reminders r
          where r.estado in ('fallido','procesando') and r.programado_en >= now() - interval '1 day'
            and exists(select 1 from jsonb_each(r.entregas) e where e.value='"en_envio"'::jsonb)) as reminders_to_review`;
    return counts;
  } finally {
    await releaseSharedDatabase(sql);
  }
}
