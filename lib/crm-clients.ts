import postgres from "postgres";
import { CLIENT_NEWSLETTER } from "@/lib/crm-clients-content";
import { getCrmEmailTemplates, type CrmEmailTemplate } from "@/lib/db";
import { parseEmailUserAgent } from "@/lib/email-engagement";

export type EmailStatus = "active" | "invalid";
export type PrivateClient = {id:string;name:string;email:string;phone:string;purchase:string;notes:string;subscribed:boolean;emailStatus:EmailStatus;emailStatusReason:string;emailInvalidAt:string|null;listName:string;leadId:string|null;updatedAt:string;lastSentAt:string|null};
export type ClientDraft = {subject:string;body:string};
export type ClientInput = {id?:string;name:string;email:string;phone:string;purchase:string;notes:string;subscribed:boolean;emailStatus?:EmailStatus;leadId?:string|null};
export function clientDb() {
  const url=process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.POSTGRES_URL_NON_POOLING||process.env.DATABASE_URL||process.env.SUPABASE_DB_URL;
  if(!url)throw Error("No hay conexión a la base de datos.");
  return postgres(url,{ssl:"require",max:1,prepare:false});
}
let ready:Promise<void>|undefined;
export async function ensureClients(sql:ReturnType<typeof clientDb>) {
  if(!ready)ready=(async()=>{
    const [schema]=await sql`SELECT
      to_regclass('public.crm_private_clients') IS NOT NULL AS clients,
      to_regclass('public.crm_client_mail_history') IS NOT NULL AS history,
      to_regclass('public.crm_client_mail_events') IS NOT NULL AS events,
      (SELECT COUNT(*)::int FROM information_schema.columns
        WHERE table_schema='public' AND table_name='crm_client_mail_history'
          AND column_name=ANY(ARRAY['campaign_id','tracking_token','list_name','template_id','owner_agent_id','reply_to_email','open_count','first_opened_at','last_opened_at','click_count','first_clicked_at','last_clicked_at','retry_count','last_attempt_at','last_error'])) AS history_columns`;
    // Keep migrations idempotent: new email-delivery fields must be added to databases
    // created by earlier versions of the CRM as well.

    const lockId=731104219;
    await sql`SELECT pg_advisory_lock(${lockId})`;
    try { await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS crm_private_clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '', purchase TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
      subscribed BOOLEAN NOT NULL DEFAULT false, email_status TEXT NOT NULL DEFAULT 'active', email_status_reason TEXT NOT NULL DEFAULT '', email_invalid_at TIMESTAMPTZ,
      list_name TEXT NOT NULL DEFAULT 'Clientes', lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL,
      created_by UUID REFERENCES agents(id), updated_by UUID REFERENCES agents(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    ALTER TABLE crm_private_clients ADD COLUMN IF NOT EXISTS list_name TEXT NOT NULL DEFAULT 'Clientes';
    ALTER TABLE crm_private_clients ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'active';
    ALTER TABLE crm_private_clients ADD COLUMN IF NOT EXISTS email_status_reason TEXT NOT NULL DEFAULT '';
    ALTER TABLE crm_private_clients ADD COLUMN IF NOT EXISTS email_invalid_at TIMESTAMPTZ;
    UPDATE crm_private_clients SET email_status='active' WHERE email_status IS NULL OR email_status NOT IN ('active','invalid');
    CREATE UNIQUE INDEX IF NOT EXISTS crm_private_clients_email ON crm_private_clients(lower(email)) WHERE email<>'';
    CREATE UNIQUE INDEX IF NOT EXISTS crm_private_clients_lead ON crm_private_clients(lead_id) WHERE lead_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS crm_private_clients_list_name ON crm_private_clients(list_name,name);
    CREATE TABLE IF NOT EXISTS crm_client_newsletter (
      id INTEGER PRIMARY KEY CHECK(id=1), subject TEXT NOT NULL, body TEXT NOT NULL,
      updated_by UUID REFERENCES agents(id), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS crm_client_mail_history (
      id UUID PRIMARY KEY, client_id UUID NOT NULL REFERENCES crm_private_clients(id),
      agent_id UUID NOT NULL REFERENCES agents(id), subject TEXT NOT NULL, body TEXT NOT NULL,
      recipient TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('sending','sent','uncertain')), campaign_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), sent_at TIMESTAMPTZ);
    ALTER TABLE crm_client_mail_history ADD COLUMN IF NOT EXISTS campaign_id UUID;
    ALTER TABLE crm_client_mail_history ADD COLUMN IF NOT EXISTS tracking_token UUID DEFAULT gen_random_uuid();
    ALTER TABLE crm_client_mail_history ADD COLUMN IF NOT EXISTS list_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE crm_client_mail_history ADD COLUMN IF NOT EXISTS template_id UUID;
    ALTER TABLE crm_client_mail_history ADD COLUMN IF NOT EXISTS owner_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;
    ALTER TABLE crm_client_mail_history ADD COLUMN IF NOT EXISTS reply_to_email TEXT NOT NULL DEFAULT '';
    ALTER TABLE crm_client_mail_history ADD COLUMN IF NOT EXISTS open_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE crm_client_mail_history ADD COLUMN IF NOT EXISTS first_opened_at TIMESTAMPTZ;
    ALTER TABLE crm_client_mail_history ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ;
    ALTER TABLE crm_client_mail_history ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE crm_client_mail_history ADD COLUMN IF NOT EXISTS first_clicked_at TIMESTAMPTZ;
    ALTER TABLE crm_client_mail_history ADD COLUMN IF NOT EXISTS last_clicked_at TIMESTAMPTZ;
    ALTER TABLE crm_client_mail_history ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE crm_client_mail_history ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;
    ALTER TABLE crm_client_mail_history ADD COLUMN IF NOT EXISTS last_error TEXT NOT NULL DEFAULT '';
    ALTER TABLE crm_client_mail_history DROP CONSTRAINT IF EXISTS crm_client_mail_history_status_check;
    ALTER TABLE crm_client_mail_history ADD CONSTRAINT crm_client_mail_history_status_check CHECK(status IN ('sending','sent','uncertain','bounced'));
    CREATE UNIQUE INDEX IF NOT EXISTS crm_client_mail_history_campaign_client ON crm_client_mail_history(campaign_id,client_id) WHERE campaign_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS crm_client_mail_history_tracking_token ON crm_client_mail_history(tracking_token) WHERE tracking_token IS NOT NULL;
    CREATE TABLE IF NOT EXISTS crm_client_mail_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), history_id UUID NOT NULL REFERENCES crm_client_mail_history(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL CHECK(event_type IN ('open','click')), occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      device_type TEXT NOT NULL DEFAULT 'Desconocido', mail_client TEXT NOT NULL DEFAULT 'No identificado',
      privacy_protected BOOLEAN NOT NULL DEFAULT false, target_url TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS crm_client_mail_events_history_time ON crm_client_mail_events(history_id,occurred_at DESC);
    ALTER TABLE crm_private_clients ENABLE ROW LEVEL SECURITY;
    ALTER TABLE crm_client_newsletter ENABLE ROW LEVEL SECURITY;
    ALTER TABLE crm_client_mail_history ENABLE ROW LEVEL SECURITY;
    ALTER TABLE crm_client_mail_events ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON crm_private_clients,crm_client_newsletter,crm_client_mail_history,crm_client_mail_events FROM anon,authenticated,PUBLIC;
  `); } finally { await sql`SELECT pg_advisory_unlock(${lockId})`; }
  })().catch(e=>{ready=undefined;throw e;});
  await ready;
}
export async function getPrivateClients(query="",page=0,listName="") {
  const sql=clientDb();
  try {
    await ensureClients(sql);
    const pattern="%"+query.replace(/[\\%_]/g,"\\$&")+"%";
    const rows=await sql`SELECT c.id,c.name,c.email,c.phone,c.purchase,c.notes,c.subscribed,c.email_status AS "emailStatus",c.email_status_reason AS "emailStatusReason",c.email_invalid_at AS "emailInvalidAt",c.list_name AS "listName",c.lead_id AS "leadId",
      c.updated_at AS "updatedAt",(SELECT MAX(sent_at) FROM crm_client_mail_history WHERE client_id=c.id AND status='sent') AS "lastSentAt"
      FROM crm_private_clients c WHERE (${listName}='' OR c.list_name=${listName}) AND (c.name ILIKE ${pattern} OR c.email ILIKE ${pattern} OR c.phone ILIKE ${pattern} OR c.purchase ILIKE ${pattern})
      ORDER BY c.name,c.id LIMIT 51 OFFSET ${page*50}`;
    return {clients:rows.slice(0,50) as unknown as PrivateClient[],hasMore:rows.length>50};
  }finally{await sql.end();}
}
export async function getClientDraft():Promise<ClientDraft> {
  const sql=clientDb();try{await ensureClients(sql);const [row]=await sql`SELECT subject,body FROM crm_client_newsletter WHERE id=1`;return row as ClientDraft || CLIENT_NEWSLETTER;}finally{await sql.end();}
}
export async function saveClient(data:ClientInput,actor:string) {
  const sql=clientDb();try{
    await ensureClients(sql);
    if(data.id) {
      const emailStatus=data.emailStatus||"active";
      const rows=await sql`UPDATE crm_private_clients SET name=${data.name},email=${data.email.toLowerCase()},phone=${data.phone},purchase=${data.purchase},
        notes=${data.notes},subscribed=${emailStatus==='invalid'?false:data.subscribed},email_status=${emailStatus},
        email_status_reason=${emailStatus==='invalid'?'Marcado como inválido desde el CRM.':''},email_invalid_at=${emailStatus==='invalid'?sql`COALESCE(email_invalid_at,NOW())`:null},updated_by=${actor},updated_at=NOW() WHERE id=${data.id} RETURNING id`;
      if(!rows.length)throw Error("El cliente ya no está disponible.");
    }else await sql`INSERT INTO crm_private_clients(name,email,phone,purchase,notes,subscribed,lead_id,created_by,updated_by)
      VALUES(${data.name},${data.email.toLowerCase()},${data.phone},${data.purchase},${data.notes},${data.subscribed},${data.leadId||null},${actor},${actor})`;
  }finally{await sql.end();}
}
export async function markClientEmailInvalid(id:string,actor:string,reason="Marcado como inválido desde el informe de campaña.") {
  const sql=clientDb();try {await ensureClients(sql);const detail=reason.slice(0,500);
    const rows=await sql.begin(async tx=>{
      const updated=await tx`UPDATE crm_private_clients SET subscribed=false,email_status='invalid',email_status_reason=${detail},email_invalid_at=NOW(),updated_by=${actor},updated_at=NOW() WHERE id=${id} RETURNING id`;
      if(updated.length)await tx`UPDATE crm_client_mail_history SET status='bounced',last_error=${detail} WHERE client_id=${id} AND status IN ('uncertain','sending')`;
      return updated;
    });
    if(!rows.length)throw Error("El contacto ya no está disponible.");
  } finally {await sql.end();}
}
export async function saveClientDraft(data:ClientDraft,actor:string) {
  const sql=clientDb();try{await ensureClients(sql);await sql`INSERT INTO crm_client_newsletter(id,subject,body,updated_by)
    VALUES(1,${data.subject},${data.body},${actor}) ON CONFLICT(id) DO UPDATE SET subject=EXCLUDED.subject,body=EXCLUDED.body,updated_by=EXCLUDED.updated_by,updated_at=NOW()`;}finally{await sql.end();}
}
export async function findClientContacts(query:string) {
  const sql=clientDb();try {
    const pattern="%"+query.replace(/[\\%_]/g,"\\$&")+"%";
    return await sql`SELECT id,concat_ws(' ',first_name,last_name) AS name,email,concat_ws('',country_code,phone) AS phone
      FROM crm_leads WHERE concat_ws(' ',first_name,last_name) ILIKE ${pattern} OR email ILIKE ${pattern}
      ORDER BY first_name,last_name,id LIMIT 20`;
  }finally{await sql.end();}
}
export type ClientLeadStatus = {status:string;eligible:number;alreadyClients:number};
export async function getClientLeadStatuses():Promise<ClientLeadStatus[]> {
  const sql=clientDb();try {
    await ensureClients(sql);
    return await sql`SELECT l.status,COUNT(*) FILTER (WHERE COALESCE(l.email,'')<>'' OR COALESCE(l.phone,'')<>'')::int AS eligible,
      COUNT(c.id)::int AS "alreadyClients"
      FROM crm_leads l LEFT JOIN crm_private_clients c ON c.lead_id=l.id
      WHERE COALESCE(TRIM(l.status),'')<>'' GROUP BY l.status ORDER BY l.status LIMIT 100` as unknown as ClientLeadStatus[];
  }finally{await sql.end();}
}
export type ClientList = {name:string;total:number;authorized:number;emailReady:number;invalidEmails:number};
export async function getClientLists():Promise<ClientList[]> {
  const sql=clientDb();try {await ensureClients(sql);return await sql`SELECT list_name AS name,COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE subscribed)::int AS authorized,COUNT(*) FILTER (WHERE subscribed AND email<>'' AND email_status='active')::int AS "emailReady",
    COUNT(*) FILTER (WHERE email_status='invalid')::int AS "invalidEmails"
    FROM crm_private_clients GROUP BY list_name ORDER BY list_name` as unknown as ClientList[];}finally{await sql.end();}
}
export async function getClientListRecipients(listName:string) {
  const sql=clientDb();try {await ensureClients(sql);return await sql`SELECT id,name,email FROM crm_private_clients
    WHERE list_name=${listName} AND subscribed AND email<>'' AND email_status='active' ORDER BY name,id` as unknown as Pick<PrivateClient,"id"|"name"|"email">[];}finally{await sql.end();}
}
export async function importClientsByLeadStatus(status:string,actor:string) {
  const sql=clientDb();try {
    await ensureClients(sql);
    return await sql.begin(async tx=>{
      const [eligible]=await tx`SELECT COUNT(*)::int AS count FROM crm_leads
        WHERE status=${status} AND (COALESCE(email,'')<>'' OR COALESCE(phone,'')<>'')`;
      const updated=await tx`UPDATE crm_private_clients c SET list_name=${status},subscribed=CASE WHEN c.email_status='invalid' THEN false ELSE true END,updated_by=${actor},updated_at=NOW()
        FROM crm_leads l WHERE c.lead_id=l.id AND l.status=${status} RETURNING c.id`;
      const added=await tx`INSERT INTO crm_private_clients(name,email,phone,purchase,notes,subscribed,list_name,lead_id,created_by,updated_by)
        SELECT COALESCE(NULLIF(TRIM(CONCAT_WS(' ',l.first_name,l.last_name)),''),NULLIF(l.email,''),'Cliente sin nombre'),
          COALESCE(l.email,''),CONCAT_WS('',COALESCE(l.country_code,''),COALESCE(l.phone,'')),
          'Incorporado desde lead «'||l.status||'','Pendiente de completar la compra.',true,l.status,l.id,${actor},${actor}
        FROM crm_leads l WHERE l.status=${status} AND (COALESCE(l.email,'')<>'' OR COALESCE(l.phone,'')<>'')
        ON CONFLICT DO NOTHING RETURNING id`;
      return {eligible:Number(eligible?.count||0),added:added.length,updated:updated.length,skipped:Number(eligible?.count||0)-added.length-updated.length};
    });
  }finally{await sql.end();}
}
export async function getClientEmailTemplates():Promise<CrmEmailTemplate[]> {
  return (await getCrmEmailTemplates()).filter(template=>template.channel==="email");
}
export async function getClientEmailTemplate(id:string):Promise<CrmEmailTemplate|null> {
  return (await getClientEmailTemplates()).find(template=>template.id===id)||null;
}

export async function registerClientMailEvent(trackingToken:string,eventType:"open"|"click",userAgent:string,targetUrl="") {
  const sql=clientDb();
  try {
    await ensureClients(sql);
    const device=parseEmailUserAgent(userAgent);
    const rows=await sql`SELECT id FROM crm_client_mail_history WHERE tracking_token=${trackingToken} LIMIT 1`;
    const historyId=String(rows[0]?.id||"");
    if(!historyId)return false;
    await sql.begin(async tx=>{
      await tx`INSERT INTO crm_client_mail_events(history_id,event_type,device_type,mail_client,privacy_protected,target_url)
        VALUES(${historyId},${eventType},${device.deviceType},${device.mailClient},${device.privacyProtected},${targetUrl})`;
      if(eventType==="open")await tx`UPDATE crm_client_mail_history SET open_count=open_count+1,
        first_opened_at=COALESCE(first_opened_at,NOW()),last_opened_at=NOW() WHERE id=${historyId}`;
      else await tx`UPDATE crm_client_mail_history SET click_count=click_count+1,
        first_clicked_at=COALESCE(first_clicked_at,NOW()),last_clicked_at=NOW() WHERE id=${historyId}`;
    });
    return true;
  } finally {await sql.end();}
}

export type ClientCampaignSummary={campaignId:string;listName:string;subject:string;sentAt:string;sent:number;notDelivered:number;bounced:number;opened:number;clicked:number;replied:number};
export async function getClientCampaigns():Promise<ClientCampaignSummary[]> {
  const sql=clientDb();
  try {await ensureClients(sql);return await sql`SELECT h.campaign_id AS "campaignId",MAX(h.list_name) AS "listName",MAX(h.subject) AS subject,
    MIN(COALESCE(h.sent_at,h.created_at)) AS "sentAt",COUNT(*) FILTER(WHERE h.status='sent')::int AS sent,
    COUNT(*) FILTER(WHERE h.status IN ('uncertain','sending','bounced'))::int AS "notDelivered",
    COUNT(*) FILTER(WHERE h.status='bounced')::int AS bounced,
    COUNT(*) FILTER(WHERE h.status='sent' AND (EXISTS(SELECT 1 FROM crm_client_mail_events e WHERE e.history_id=h.id AND e.event_type='open' AND NOT e.privacy_protected)
      OR EXISTS(SELECT 1 FROM crm_client_mail_events e WHERE e.history_id=h.id AND e.event_type='click')))::int AS opened,
    COUNT(*) FILTER(WHERE h.status='sent' AND EXISTS(SELECT 1 FROM crm_client_mail_events e WHERE e.history_id=h.id AND e.event_type='click'))::int AS clicked,
    COUNT(*) FILTER(WHERE h.status='sent' AND EXISTS(SELECT 1 FROM crm_activities a WHERE a.lead_id=c.lead_id AND a.external_source='gmail_inbound' AND a.created_at>=h.sent_at))::int AS replied
    FROM crm_client_mail_history h JOIN crm_private_clients c ON c.id=h.client_id WHERE h.campaign_id IS NOT NULL
    GROUP BY h.campaign_id ORDER BY MIN(COALESCE(h.sent_at,h.created_at)) DESC LIMIT 30` as unknown as ClientCampaignSummary[];}finally{await sql.end();}
}

export type ClientCampaignReport={summary:ClientCampaignSummary;contacts:Array<{id:string;clientId:string;name:string;email:string;ownerName:string;status:"sent"|"sending"|"uncertain"|"bounced";error:string;emailStatus:EmailStatus;openCount:number;automatedOpenCount:number;clickCount:number;firstOpenedAt:string|null;lastOpenedAt:string|null;estimatedOpenSeconds:number;deviceType:string;mailClient:string;privacyProtected:boolean;clickedLinks:string[];repliedAt:string|null;score:number}>};
export async function getClientCampaignReport(campaignId:string):Promise<ClientCampaignReport|null> {
  const sql=clientDb();
  try {
    await ensureClients(sql);
    const campaigns=await sql`SELECT h.campaign_id AS "campaignId",MAX(h.list_name) AS "listName",MAX(h.subject) AS subject,
      MIN(COALESCE(h.sent_at,h.created_at)) AS "sentAt",COUNT(*) FILTER(WHERE h.status='sent')::int AS sent,
      COUNT(*) FILTER(WHERE h.status IN ('uncertain','sending','bounced'))::int AS "notDelivered",
      COUNT(*) FILTER(WHERE h.status='bounced')::int AS bounced,
      COUNT(*) FILTER(WHERE h.status='sent' AND (EXISTS(SELECT 1 FROM crm_client_mail_events e WHERE e.history_id=h.id AND e.event_type='open' AND NOT e.privacy_protected)
        OR EXISTS(SELECT 1 FROM crm_client_mail_events e WHERE e.history_id=h.id AND e.event_type='click')))::int AS opened,
      COUNT(*) FILTER(WHERE h.status='sent' AND EXISTS(SELECT 1 FROM crm_client_mail_events e WHERE e.history_id=h.id AND e.event_type='click'))::int AS clicked,
      COUNT(*) FILTER(WHERE h.status='sent' AND EXISTS(SELECT 1 FROM crm_activities a WHERE a.lead_id=c.lead_id AND a.external_source='gmail_inbound' AND a.created_at>=h.sent_at))::int AS replied
      FROM crm_client_mail_history h JOIN crm_private_clients c ON c.id=h.client_id WHERE h.campaign_id=${campaignId}
      GROUP BY h.campaign_id`;
    if(!campaigns[0])return null;
    const rows=await sql`SELECT h.id,c.id AS "clientId",c.name,h.recipient AS email,COALESCE(a.name,'Sin asignar') AS "ownerName",h.status,h.last_error AS error,c.email_status AS "emailStatus",
      GREATEST(COALESCE(signals.direct_opens,0),CASE WHEN COALESCE(signals.clicks,0)>0 THEN 1 ELSE 0 END)::int AS "openCount",
      COALESCE(signals.automated_opens,0)::int AS "automatedOpenCount",COALESCE(signals.clicks,0)::int AS "clickCount",
      LEAST(signals.first_direct_open,signals.first_click) AS "firstOpenedAt",signals.last_direct_open AS "lastOpenedAt",
      0::int AS "estimatedOpenSeconds",
      CASE WHEN ev.privacy_protected THEN 'No identificable'
        WHEN ev.device_type='Móvil' AND ev.mail_client='Apple Mail o navegador Apple' THEN 'iPhone'
        ELSE COALESCE(ev.device_type,'No identificado') END AS "deviceType",
      COALESCE(ev.mail_client,'No identificado') AS "mailClient",COALESCE(ev.privacy_protected,false) AS "privacyProtected",
      COALESCE(signals.urls,ARRAY[]::text[]) AS "clickedLinks",reply.created_at AS "repliedAt",
      (LEAST(GREATEST(COALESCE(signals.direct_opens,0),CASE WHEN COALESCE(signals.clicks,0)>0 THEN 1 ELSE 0 END),5)
        +COALESCE(signals.clicks,0)*4+CASE WHEN reply.created_at IS NOT NULL THEN 10 ELSE 0 END)::int AS score
      FROM crm_client_mail_history h JOIN crm_private_clients c ON c.id=h.client_id
      LEFT JOIN agents a ON a.id=h.owner_agent_id
      LEFT JOIN LATERAL(SELECT
        COUNT(*) FILTER(WHERE e.event_type='open' AND NOT e.privacy_protected)::int AS direct_opens,
        COUNT(*) FILTER(WHERE e.event_type='open' AND e.privacy_protected)::int AS automated_opens,
        COUNT(*) FILTER(WHERE e.event_type='click')::int AS clicks,
        MIN(e.occurred_at) FILTER(WHERE e.event_type='open' AND NOT e.privacy_protected) AS first_direct_open,
        MAX(e.occurred_at) FILTER(WHERE e.event_type='open' AND NOT e.privacy_protected) AS last_direct_open,
        MIN(e.occurred_at) FILTER(WHERE e.event_type='click') AS first_click,
        ARRAY_AGG(DISTINCT e.target_url) FILTER(WHERE e.event_type='click' AND e.target_url<>'') AS urls
        FROM crm_client_mail_events e WHERE e.history_id=h.id)signals ON true
      LEFT JOIN LATERAL(SELECT device_type,mail_client,privacy_protected FROM crm_client_mail_events e WHERE e.history_id=h.id
        ORDER BY CASE WHEN e.event_type='click' THEN 0 WHEN e.event_type='open' AND NOT e.privacy_protected THEN 1 ELSE 2 END,occurred_at DESC LIMIT 1)ev ON true
      LEFT JOIN LATERAL(SELECT created_at FROM crm_activities act WHERE act.lead_id=c.lead_id AND act.external_source='gmail_inbound' AND act.created_at>=h.sent_at ORDER BY created_at LIMIT 1)reply ON true
      WHERE h.campaign_id=${campaignId} ORDER BY CASE WHEN h.status='bounced' THEN 0 WHEN h.status IN ('uncertain','sending') THEN 1 ELSE 2 END,score DESC,h.last_clicked_at DESC NULLS LAST,h.last_opened_at DESC NULLS LAST,c.name`;
    return {summary:campaigns[0] as unknown as ClientCampaignSummary,contacts:rows as unknown as ClientCampaignReport["contacts"]};
  } finally {await sql.end();}
}
