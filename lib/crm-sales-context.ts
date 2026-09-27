import postgres from "postgres";
import type { SalesEvidence, SalesEvent } from "./crm-sales-priority";

// Ownership is rechecked in SQL. WhatsApp is linked by lead_id only, never by phone suffix.
export async function getSalesEvidence(ids:string[], actorId:string, includeAll:boolean, focused=false):Promise<SalesEvidence[]> {
  if(!ids.length)return [];
  const url=process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if(!url)throw new Error("No hay conexión al CRM");
  const sql=postgres(url,{ssl:"require",max:1,prepare:false,connect_timeout:10});
  try {
    const tables=await sql`SELECT to_regclass('public.crm_whatsapp_messages') IS NOT NULL AND to_regclass('public.crm_whatsapp_conversations') IS NOT NULL AS wa, to_regclass('public.crm_activity_results') IS NOT NULL AS results`;
    const wa=tables[0].wa ? sql`UNION ALL SELECT m.id::text,c.lead_id,'whatsapp','Mensaje de WhatsApp',LEFT(m.content,1800),m.created_at,NULL::timestamptz,ag.name,m.direction,NULL::text FROM crm_whatsapp_messages m JOIN crm_whatsapp_conversations c ON c.id=m.conversation_id JOIN allowed l ON l.id=c.lead_id LEFT JOIN agents ag ON ag.id=m.sender_agent_id WHERE m.status NOT IN ('failed','error') AND NOT EXISTS (SELECT 1 FROM crm_activities a WHERE a.lead_id=c.lead_id AND a.external_id=m.whatsapp_message_id)` : sql``;
    const rows=await sql`
      WITH allowed AS (SELECT id FROM crm_leads WHERE id=ANY(${ids}) AND (${includeAll} OR assigned_agent_id=${actorId})),
      events AS (
        SELECT a.id::text,a.lead_id,a.type AS tipo,a.title AS titulo,LEFT(a.body,1800) AS detalle,
          CASE WHEN a.type IN ('correo','whatsapp') THEN COALESCE(a.scheduled_at,a.created_at) ELSE a.created_at END AS fecha,
          a.scheduled_at AS programado,ag.name AS responsable,
          CASE WHEN a.external_source IN ('gmail_inbound','whatsapp_inbound') OR a.title ~* '^(Respuesta por correo|Respuesta por WhatsApp|WhatsApp recibido)' THEN 'inbound'
            WHEN a.type IN ('correo','whatsapp') AND a.title !~* '(abierto|apertura|clic|click|fallido|error)' THEN 'outbound' ELSE 'registro' END AS direccion,
          ${tables[0].results ? sql`(SELECT outcome FROM crm_activity_results WHERE activity_id=a.id)` : sql`NULL::text`} AS resultado
        FROM crm_activities a JOIN allowed l ON l.id=a.lead_id LEFT JOIN agents ag ON ag.id=a.created_by
        ${wa}
      ), ranked AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY lead_id ORDER BY fecha DESC,id) AS rn FROM events)
      SELECT l.id,COUNT(r.id)::int AS total,
        COALESCE(jsonb_agg(to_jsonb(r) - 'lead_id' - 'rn' ORDER BY r.fecha DESC,r.id) FILTER(WHERE rn<=${focused?80:8}), '[]'::jsonb) AS events,
        COALESCE(jsonb_agg(to_jsonb(r) - 'lead_id' - 'rn' ORDER BY r.programado) FILTER(WHERE r.tipo IN ('reunion','tarea') AND r.programado >= date_trunc('day',NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires' AND r.programado < NOW()+INTERVAL '14 days'), '[]'::jsonb) AS next,
        MAX(r.fecha) FILTER(WHERE r.direccion='inbound' AND r.fecha<=NOW()) AS last_inbound,
        MAX(r.fecha) FILTER(WHERE r.direccion='outbound' AND r.fecha<=NOW()) AS last_outbound,
        MAX(r.fecha) FILTER(WHERE (r.direccion IN ('inbound','outbound') OR r.tipo='llamada') AND r.fecha<=NOW()) AS last_contact,
        COUNT(r.id) FILTER(WHERE r.tipo IN ('correo','whatsapp','llamada'))::int AS communications
      FROM allowed l LEFT JOIN ranked r ON r.lead_id=l.id GROUP BY l.id`;
    return rows.map(r=>({id:String(r.id),total:Number(r.total),events:r.events as SalesEvent[],next:r.next as SalesEvent[],lastInbound:r.last_inbound?new Date(r.last_inbound).toISOString():undefined,lastOutbound:r.last_outbound?new Date(r.last_outbound).toISOString():undefined,lastContact:r.last_contact?new Date(r.last_contact).toISOString():undefined,communications:Number(r.communications)}));
  }finally{await sql.end();}
}
