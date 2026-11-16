import { MEET_EMAIL_NOTICE, verifiedMeetUrl } from './meeting-links';
import { acquireWorkerLease, releaseWorkerLease } from '@/lib/database-worker-lease';
import { meetingDayLabel } from './meeting-date';
import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
import { sendPrivateClientEmail } from '@/lib/crm-email-sender';
import { sendWhatsAppText } from '@/lib/whatsapp-inbox';
import { newMiaEngineAllows } from './rollout';
import { meetingReminderTemplates } from './meeting-reminder-templates';

type Template = {subject?: string; body: string};

function render(text: string, values: Record<string, unknown>) {
  return text.replace(/\{\{([a-z_]+)\}\}/g, (_, name: string) => String(values[name] ?? ''));
}

export async function processMiaReminders() {
  const sql = getSharedDatabase();
  const result = {sent: 0, failed: 0};
  try {
    const candidates = await sql`
      select r.id, c.whatsapp, c.email, m.google_event_id
      from public.mia_reminders r join public.mia_meetings m on m.id = r.meeting_id
      join public.mia_clients c on c.id = m.client_id
      where m.estado in ('confirmada', 'reprogramada') and r.estado in ('pendiente', 'fallido')
        and r.intentos < 2 and r.programado_en <= now() and not exists (
          select 1 from public.crm_mia_meeting_sessions s
          where s.state->>'eventId' = m.google_event_id and s.state->'changeRequest'->>'moving' = 'true'
        )
        and (m.dia::text || ' ' || m.hora::text)::timestamp at time zone 'America/Argentina/Buenos_Aires' > now()
      order by r.programado_en limit 4`;
    for (const candidate of candidates) {
      if (!newMiaEngineAllows(candidate.whatsapp ?? '', candidate.email ?? '', {
        MIA_NEW_ENGINE_ENABLED: process.env.MIA_NEW_ENGINE_ENABLED,
        MIA_TEST_NUMBERS: process.env.MIA_TEST_NUMBERS,
        MIA_TEST_EMAILS: process.env.MIA_TEST_EMAILS,
      })) continue;
      const leaseKey = 'mia-meeting-reminder:' + candidate.google_event_id;
      const lease = await acquireWorkerLease(sql, leaseKey);
      if (!lease) continue;
      try {
        const [job] = await sql`
          update public.mia_reminders r set estado = 'procesando', intentos = r.intentos + 1
          from public.mia_meetings m
          where r.id = ${candidate.id} and r.estado in ('pendiente', 'fallido') and r.intentos < 2
            and r.meeting_id = m.id and m.estado in ('confirmada', 'reprogramada')
            and (m.dia::text || ' ' || m.hora::text)::timestamp at time zone 'America/Argentina/Buenos_Aires' > now()
            and not exists (
              select 1 from public.crm_mia_meeting_sessions s
              where s.state->>'eventId' = m.google_event_id and s.state->'changeRequest'->>'moving' = 'true'
            )
          returning r.*`;
        if (!job) continue;
        try {
          const [meeting] = await sql`
            select m.*, to_char(m.dia, 'YYYY-MM-DD') as meeting_day,
              to_char(m.hora, 'HH24:MI') as meeting_time, c.nombre, c.email, c.whatsapp, c.para_que, c.zona, c.presupuesto,
              c.entrega, c.boton_caliente, c.resumen, c.crm_lead_id, a.id as agent_id,
              a.email as agent_email, to_jsonb(a)->>'phone' as agent_phone,
              coalesce((to_jsonb(a)->>'mia_recordatorios_solo_mail')::boolean, false) as solo_mail
            from public.mia_meetings m join public.mia_clients c on c.id = m.client_id
            left join public.agents a on lower(a.name) = lower(m.agente)
              and lower(a.email) in ('pablo@barrerabrokers.com','lucas@barrerabrokers.com') and a.active
            where m.id = ${job.meeting_id} and m.estado in ('confirmada', 'reprogramada')`;
          if (!meeting) {
            await sql`update public.mia_reminders set estado = 'cancelado' where id = ${job.id}`;
            continue;
          }
          if (!meeting.agent_id || !meeting.whatsapp || (!meeting.lugar_link && meeting.modalidad !== 'google_meet')) throw new Error('Missing reminder data');
          const timing = job.tipo === '1_dia_antes' ? '1d' : '1h';
          const builtIn = meetingReminderTemplates[timing];
          const isMeet = meeting.modalidad === 'google_meet';
          const meetLink = isMeet ? verifiedMeetUrl(meeting.lugar_link) : null;
          const details = isMeet ? (meetLink ? 'Link: ' + meetLink + '.' : MEET_EMAIL_NOTICE)
            : meeting.modalidad === 'phone' ? 'Teléfono: ' + meeting.lugar_link + '.' : 'Dirección: ' + meeting.lugar_link + '.';
          const values = {
            nombre_cliente: meeting.nombre, whatsapp_cliente: meeting.whatsapp, email_cliente: meeting.email,
            agente: meeting.agente,
            dia: meetingDayLabel(new Date(meeting.meeting_day + 'T12:00:00-03:00')),
            hora: meeting.meeting_time,
            detalles: details, modalidad: meeting.modalidad === 'google_meet' ? 'Google Meet' : meeting.modalidad === 'phone' ? 'teléfono' : 'presencial', link_meet_o_direccion: isMeet ? meetLink ?? MEET_EMAIL_NOTICE : meeting.lugar_link,
            propiedad_de_interes: meeting.propiedad_de_interes, zona: meeting.zona, para_que: meeting.para_que,
            presupuesto: meeting.presupuesto, entrega: meeting.entrega, boton_caliente: meeting.boton_caliente,
            resumen_conversacion: meeting.resumen,
            link_crm: meeting.crm_lead_id ? 'https://barrerabrokers.com/admin/crm/' + meeting.crm_lead_id : '',
          };
          const deliveries: {key: string; address: string; template: Template}[] = [
            {key: 'cliente_whatsapp', address: meeting.whatsapp, template: {body: builtIn.cliente.whatsapp}},
            {key: 'agente_email', address: meeting.agent_email, template: builtIn.agente.email},
          ];
          if (meeting.email) deliveries.push({key: 'cliente_email', address: meeting.email, template: builtIn.cliente.email});
          if (!meeting.solo_mail) deliveries.push({
            key: 'agente_whatsapp', address: meeting.agent_phone,
            template: {body: timing === '1d'
              ? 'Recordatorio: mañana tenés reunión con {{nombre_cliente}} {{dia}} {{hora}}, {{modalidad}}, {{link_meet_o_direccion}}. Teléfono cliente: {{whatsapp_cliente}}.'
              : 'En una hora tenés reunión con {{nombre_cliente}}, {{dia}} {{hora}}, {{modalidad}}.'},
          });

          let needsReview = false;
          for (const delivery of deliveries) {
            if (job.entregas[delivery.key] === true) continue;
            if (job.entregas[delivery.key] === 'en_envio') {
              needsReview = true;
              continue;
            }
            if (!delivery.address) throw new Error('Missing reminder recipient');
            const [eligible] = await sql`select r.id from public.mia_reminders r
              join public.mia_meetings m on m.id = r.meeting_id
              where r.id = ${job.id} and r.estado = 'procesando' and m.estado in ('confirmada', 'reprogramada')`;
            if (!eligible) {
              await sql`update public.mia_reminders set estado = 'cancelado' where id = ${job.id}`;
              break;
            }
            const body = render(delivery.template.body, values);
            // A provider timeout can happen after accepting the message. Preserve
            // ambiguous deliveries for review instead of dispatching them twice.
            const [dispatch] = await sql`update public.mia_reminders
              set entregas = entregas || ${sql.json({[delivery.key]: 'en_envio'})}
              where id = ${job.id} and estado = 'procesando' and not (entregas ? ${delivery.key}) returning id`;
            if (!dispatch) throw new Error('Reminder delivery claim changed');
            if (delivery.template.subject) {
              await sendPrivateClientEmail({agentId: meeting.agent_id, email: delivery.address,
                subject: render(delivery.template.subject, values), body});
            } else {
              await sendWhatsAppText(delivery.address, body);
            }
            await sql`update public.mia_reminders set entregas = entregas || ${sql.json({[delivery.key]: true})}
              where id = ${job.id}`;
          }
          if (needsReview) throw new Error('Reminder delivery requires review');
          const updated = await sql`update public.mia_reminders set estado = 'enviado', enviado_en = now()
            where id = ${job.id} and estado = 'procesando' returning id`;
          result.sent += updated.length;
        } catch {
          console.error('mia-reminder-failed', {id: job.id, attempt: job.intentos});
          await sql`update public.mia_reminders set estado = 'fallido' where id = ${job.id} and estado = 'procesando'`;
          await sql`
            insert into public.mia_observations (client_id, que_paso, propuesta, estado)
            select client_id, 'Falló un recordatorio de reunión', ${'Revisar recordatorio ' + job.id}, 'pendiente'
            from public.mia_meetings where id = ${job.meeting_id}`;
          result.failed++;
        }
      } finally {
        await releaseWorkerLease(sql, leaseKey, lease);
      }
    }
    return result;
  } finally {
    await releaseSharedDatabase(sql);
  }
}
