import type postgres from "postgres";

export const REMINDER_NOTIFICATIONS_SQL = `
INSERT INTO crm_notifications(id,recipient_agent_id,lead_id,event_key,type,title,body,href,expires_at,source_id)
SELECT gen_random_uuid(),COALESCE(l.assigned_agent_id,a.created_by),a.lead_id,
 'task:'||a.id||':'||a.scheduled_at||':'||COALESCE(s.reminder_minutes,60),'task_reminder',
 'Recordatorio de tarea',a.title||' · '||to_char(a.scheduled_at AT TIME ZONE 'America/Argentina/Buenos_Aires','DD/MM HH24:MI')||' (Argentina)',
 '/admin/crm/'||a.lead_id||'?activity=tarea',a.scheduled_at,a.id
FROM crm_activities a JOIN crm_leads l ON l.id=a.lead_id LEFT JOIN crm_task_schedules s ON s.activity_id=a.id
WHERE a.type='tarea' AND COALESCE(l.assigned_agent_id,a.created_by) IS NOT NULL
 AND a.scheduled_at>NOW() AND a.scheduled_at-make_interval(mins=>COALESCE(s.reminder_minutes,60))<=NOW()
UNION ALL
SELECT gen_random_uuid(),COALESCE(s.calendar_agent_id,a.created_by,l.assigned_agent_id),a.lead_id,
 'meeting:'||a.id||':'||a.scheduled_at||':60','meeting_reminder','Recordatorio de reunión',
 a.title||' · '||to_char(a.scheduled_at AT TIME ZONE 'America/Argentina/Buenos_Aires','DD/MM HH24:MI')||' (Argentina)',
 '/admin/crm/'||a.lead_id||'?activity=reunion',a.scheduled_at,a.id
FROM crm_activities a JOIN crm_leads l ON l.id=a.lead_id LEFT JOIN crm_meeting_schedules s ON s.activity_id=a.id
WHERE a.type='reunion' AND s.cancelled_at IS NULL AND COALESCE(s.calendar_agent_id,a.created_by,l.assigned_agent_id) IS NOT NULL
 AND a.scheduled_at>NOW() AND a.scheduled_at-INTERVAL '1 hour'<=NOW()
UNION ALL
SELECT gen_random_uuid(),b.agent_id,l.id,'booking:'||b.id||':'||b.starts_at||':60',
 'meeting_reminder','Recordatorio de reunión','Reunión agendada · '||to_char(b.starts_at AT TIME ZONE 'America/Argentina/Buenos_Aires','DD/MM HH24:MI')||' (Argentina)',
 '/admin/crm/calendario',b.starts_at,b.id
FROM crm_meeting_bookings b LEFT JOIN LATERAL (
 SELECT id FROM crm_leads WHERE assigned_agent_id=b.agent_id AND lower(email)=lower(b.guest_email) ORDER BY created_at DESC LIMIT 1
) l ON TRUE
WHERE b.starts_at>NOW() AND b.starts_at-INTERVAL '1 hour'<=NOW()
 AND NOT EXISTS(SELECT 1 FROM crm_activities a WHERE a.external_source='google_calendar' AND a.external_id=b.google_event_id)
ON CONFLICT(event_key) DO UPDATE SET recipient_agent_id=EXCLUDED.recipient_agent_id,expires_at=EXCLUDED.expires_at
RETURNING id
`;

export async function persistCrmReminderNotifications(sql: ReturnType<typeof postgres>) {
  // Expire alerts after cancellation, removal or rescheduling so they cannot
  // reach a device later with an obsolete time or owner.
  await sql`UPDATE crm_notifications n SET expires_at=NOW() WHERE n.expires_at>NOW() AND (
    (n.type='task_reminder' AND NOT EXISTS(SELECT 1 FROM crm_activities a JOIN crm_leads l ON l.id=a.lead_id
      LEFT JOIN crm_task_schedules s ON s.activity_id=a.id WHERE a.id=n.source_id AND a.type='tarea'
      AND a.scheduled_at=n.expires_at AND COALESCE(l.assigned_agent_id,a.created_by)=n.recipient_agent_id
      AND n.event_key='task:'||a.id||':'||a.scheduled_at||':'||COALESCE(s.reminder_minutes,60)))
    OR (n.type='meeting_reminder' AND n.event_key LIKE 'meeting:%' AND NOT EXISTS(
      SELECT 1 FROM crm_activities a JOIN crm_leads l ON l.id=a.lead_id LEFT JOIN crm_meeting_schedules s ON s.activity_id=a.id
      WHERE a.id=n.source_id AND a.type='reunion' AND a.scheduled_at=n.expires_at AND s.cancelled_at IS NULL
      AND COALESCE(s.calendar_agent_id,a.created_by,l.assigned_agent_id)=n.recipient_agent_id))
    OR (n.type='meeting_reminder' AND n.event_key LIKE 'booking:%' AND NOT EXISTS(
      SELECT 1 FROM crm_meeting_bookings b WHERE b.id=n.source_id AND b.starts_at=n.expires_at AND b.agent_id=n.recipient_agent_id))
  )`;
  const reminders = await sql.unsafe(REMINDER_NOTIFICATIONS_SQL);
  // Recover first openings if tracking persisted before notification creation.
  await sql`INSERT INTO crm_notifications(id,recipient_agent_id,lead_id,event_key,type,title,body,href,created_at)
    SELECT gen_random_uuid(),COALESCE(t.agent_id,l.assigned_agent_id),l.id,'email-open:'||t.id,'email_open',
      COALESCE(NULLIF(BTRIM(CONCAT_WS(' ',l.first_name,l.last_name)),''),NULLIF(l.email,''),'Un cliente')||' abrió tu correo',
      'Asunto: '||COALESCE(NULLIF(t.subject,''),'Sin asunto'),'/admin/crm/'||l.id||'?activity=correo&email='||t.id,t.first_opened_at
    FROM crm_email_trackings t JOIN crm_leads l ON l.id=t.lead_id
    WHERE t.first_opened_at>NOW()-INTERVAL '24 hours' AND COALESCE(t.agent_id,l.assigned_agent_id) IS NOT NULL
    ON CONFLICT(event_key) DO UPDATE SET title=EXCLUDED.title,body=EXCLUDED.body,href=EXCLUDED.href
    WHERE crm_notifications.title IS DISTINCT FROM EXCLUDED.title OR crm_notifications.body IS DISTINCT FROM EXCLUDED.body OR crm_notifications.href IS DISTINCT FROM EXCLUDED.href`;
  return reminders.length;
}
