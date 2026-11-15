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
      select r.id, c.whatsapp, c.email
      from public.mia_reminders r join public.mia_meetings m on m.id = r.meeting_id
      join public.mia_clients c on c.id = m.client_id
      where m.estado = 'confirmada' and r.estado in ('pendiente', 'fallido')
        and r.intentos < 2 and r.programado_en <= now()
        and (m.dia::text || ' ' || m.hora::text)::timestamp at time zone 'America/Argentina/Buenos_Aires' > now()
      order by r.programado_en limit 4`;
    for (const candidate of candidates) {
      if (!newMiaEngineAllows(candidate.whatsapp ?? '', candidate.email ?? '', {
        MIA_NEW_ENGINE_ENABLED: process.env.MIA_NEW_ENGINE_ENABLED,
        MIA_TEST_NUMBERS: process.env.MIA_TEST_NUMBERS,
        MIA_TEST_EMAILS: process.env.MIA_TEST_EMAILS,
      })) continue;
      const [job] = await sql`
        update public.mia_reminders set estado = 'procesando', intentos = intentos + 1
        where id = ${candidate.id} and estado in ('pendiente', 'fallido') and intentos < 2
        returning *`;
      if (!job) continue;
      try {
        const [meeting] = await sql`
          select m.*, c.nombre, c.email, c.whatsapp, c.para_que, c.zona, c.presupuesto,
            c.entrega, c.boton_caliente, c.resumen, c.crm_lead_id, a.id as agent_id,
            a.email as agent_email, to_jsonb(a)->>'phone' as agent_phone,
            coalesce((to_jsonb(a)->>'mia_recordatorios_solo_mail')::boolean, false) as solo_mail
          from public.mia_meetings m join public.mia_clients c on c.id = m.client_id
          left join public.agents a on lower(a.name) = lower(m.agente)
            and lower(a.email) in ('pablo@barrerabrokers.com','lucas@barrerabrokers.com') and a.active
          where m.id = ${job.meeting_id} and m.estado = 'confirmada'`;
        if (!meeting) {
          await sql`update public.mia_reminders set estado = 'cancelado' where id = ${job.id}`;
          continue;
        }
        if (!meeting.agent_id || !meeting.whatsapp || !meeting.lugar_link) throw new Error('Missing reminder data');
        const timing = job.tipo === '1_dia_antes' ? '1d' : '1h';
        const builtIn = meetingReminderTemplates[timing];
        const values = {
          nombre_cliente: meeting.nombre, whatsapp_cliente: meeting.whatsapp, email_cliente: meeting.email,
          agente: meeting.agente, dia: meeting.dia, hora: String(meeting.hora).slice(0, 5),
          modalidad: meeting.modalidad, link_meet_o_direccion: meeting.lugar_link,
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

        for (const delivery of deliveries) {
          if (job.entregas[delivery.key]) continue;
          if (!delivery.address) throw new Error('Missing reminder recipient');
          const [eligible] = await sql`select id from public.mia_meetings where id = ${meeting.id} and estado = 'confirmada'`;
          if (!eligible) {
            await sql`update public.mia_reminders set estado = 'cancelado' where id = ${job.id}`;
            break;
          }
          const body = render(delivery.template.body, values);
          if (delivery.template.subject) {
            await sendPrivateClientEmail({agentId: meeting.agent_id, email: delivery.address,
              subject: render(delivery.template.subject, values), body});
          } else {
            await sendWhatsAppText(delivery.address, body);
          }
          await sql`update public.mia_reminders set entregas = entregas || ${sql.json({[delivery.key]: true})}
            where id = ${job.id}`;
        }
        const updated = await sql`update public.mia_reminders set estado = 'enviado', enviado_en = now()
          where id = ${job.id} and estado = 'procesando' returning id`;
        result.sent += updated.length;
      } catch {
        console.error('mia-reminder-failed', {id: job.id, attempt: job.intentos});
        await sql`update public.mia_reminders set estado = 'fallido' where id = ${job.id}`;
        await sql`
          insert into public.mia_observations (client_id, que_paso, propuesta, estado)
          select client_id, 'Falló un recordatorio de reunión', ${'Revisar recordatorio ' + job.id}, 'pendiente'
          from public.mia_meetings where id = ${job.meeting_id}`;
        result.failed++;
      }
    }
    return result;
  } finally {
    await releaseSharedDatabase(sql);
  }
}
