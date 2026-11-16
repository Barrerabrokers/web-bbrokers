import { recordMiaSalesWhatsAppInteraction } from "@/lib/mia-sales-interactions";
import { getMiaAccess, miaAccessAllows } from '@/lib/mia-access';
import { persistWhatsAppLeadForm } from "@/lib/whatsapp-lead-enrichment";
import { deliverMetaSocialText } from '@/lib/meta-social-send';
import { generateMiaResetReply } from '@/lib/mia-reset-runtime';
import { generateMiaWhatsAppReply } from '@/mia/lib/whatsapp-flow';
import { replyMiaMeeting } from '@/mia/lib/meetings';
import { repeatsLastMessage, socialClosing } from '@/mia/lib/reply-safety';
import { meetingIntent } from '@/lib/mia-meeting-policy';
import { asksMeetingStatus, routesToMiaMeeting } from '@/mia/lib/meeting-routing';
import { newMiaEngineAllows } from '@/mia/lib/rollout';
import { ensureContactIdentitySchema, phoneIdentityVariants, notifyCompanyWhatsAppReply, findContactLead } from '@/lib/whatsapp-contact-identity';
import type { WhatsAppAttachment } from '@/lib/whatsapp-attachments';
import { requestsHuman } from "@/lib/whatsapp-sales-policy";
import { firstContactWhatsAppPhoneId } from "@/lib/whatsapp-inbox-scope";
import crypto from "crypto";
import { getWhatsAppAppSecret } from "@/lib/meta-app-config";
import { getMetaSocialCredentials, getMetaSocialContactName } from "@/lib/meta-social";
import postgres from "postgres";
import { splitInternationalPhone } from "@/lib/phone-countries";
import { upsertCrmLead, upsertCrmLeadByEmail } from "@/lib/db";
import { getWhatsAppChannelCredentials } from "@/lib/whatsapp-credentials";
import { selectWhatsAppSender, deliverWhatsAppText, deliverWhatsAppAttachment, WHATSAPP_TEST_PHONE_ID } from "@/lib/whatsapp-send";

export type WhatsAppConversation = {
  id: string;
  phone: string;
  businessPhoneNumberId?: string;
  contactName: string;
  leadId?: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  aiEnabled: boolean;
  aiAssistAssigned?: boolean;
  status: "open" | "closed";
  unreadCount: number;
  lastMessage: string;
  lastMessageAt: string;
  lockedBy?: string;
  lockedByName?: string;
  lockedUntil?: string;
  channel: "whatsapp" | "instagram" | "facebook";
  externalContactId?: string;
};

export type WhatsAppMessage = {
  id: string;
  conversationId: string;
  whatsappMessageId?: string;
  direction: "inbound" | "outbound" | "unknown";
  senderType: "customer" | "ai" | "agent" | "history";
  senderAgentId?: string;
  senderName?: string;
  content: string;
  status: string;
  createdAt: string;
  attachment?: WhatsAppAttachment;
};

function connection() {
  const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("No database connection URL found");
  return postgres(url, { ssl: "require", max: 1, prepare: false });
}

let schemaPromise: Promise<void> | null = null;
export async function ensureWhatsAppInboxSchema() {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    const sql = connection();
    try {
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS crm_whatsapp_conversations (
          id UUID PRIMARY KEY,
          phone TEXT NOT NULL UNIQUE,
          contact_name TEXT NOT NULL DEFAULT '',
          lead_id UUID NULL REFERENCES crm_leads(id) ON DELETE SET NULL,
          assigned_agent_id UUID NULL REFERENCES agents(id) ON DELETE SET NULL,
          ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          status TEXT NOT NULL DEFAULT 'open',
          unread_count INTEGER NOT NULL DEFAULT 0,
          last_message TEXT NOT NULL DEFAULT '',
          last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          locked_by UUID NULL REFERENCES agents(id) ON DELETE SET NULL,
          locked_until TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE crm_whatsapp_conversations ADD COLUMN IF NOT EXISTS ai_assist_assigned BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE crm_whatsapp_conversations ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'whatsapp';
        ALTER TABLE crm_whatsapp_conversations ADD COLUMN IF NOT EXISTS external_contact_id TEXT NULL;
        ALTER TABLE crm_whatsapp_conversations ADD COLUMN IF NOT EXISTS business_phone_number_id TEXT NULL;
        CREATE TABLE IF NOT EXISTS crm_whatsapp_messages (
          id UUID PRIMARY KEY,
          conversation_id UUID NOT NULL REFERENCES crm_whatsapp_conversations(id) ON DELETE CASCADE,
          whatsapp_message_id TEXT NULL UNIQUE,
          direction TEXT NOT NULL,
          sender_type TEXT NOT NULL,
          sender_agent_id UUID NULL REFERENCES agents(id) ON DELETE SET NULL,
          content TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'sent',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE crm_whatsapp_messages ADD COLUMN IF NOT EXISTS attachment JSONB NULL;
        ALTER TABLE crm_whatsapp_conversations ADD COLUMN IF NOT EXISTS reply_send_token UUID NULL;
        CREATE INDEX IF NOT EXISTS idx_wa_conversations_owner ON crm_whatsapp_conversations(assigned_agent_id, last_message_at DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_conversations_channel_contact ON crm_whatsapp_conversations(channel, external_contact_id) WHERE external_contact_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation ON crm_whatsapp_messages(conversation_id, created_at);
      `);
      await ensureContactIdentitySchema(sql);
    } finally {
      await sql.end();
    }
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}

function mapConversation(row: any): WhatsAppConversation {
  return {
    id: row.id,
    phone: row.phone,
    businessPhoneNumberId: row.business_phone_number_id || undefined,
    contactName: row.contact_name || row.lead_name || row.phone,
    leadId: row.lead_id || undefined,
    assignedAgentId: row.assigned_agent_id || undefined,
    assignedAgentName: row.assigned_agent_name || undefined,
    aiEnabled: Boolean(row.ai_enabled),
    aiAssistAssigned: Boolean(row.ai_assist_assigned),
    status: row.status === "closed" ? "closed" : "open",
    unreadCount: Number(row.unread_count || 0),
    lastMessage: row.last_message || "",
    lastMessageAt: new Date(row.last_message_at).toISOString(),
    lockedBy: row.locked_by || undefined,
    lockedByName: row.locked_by_name || undefined,
    lockedUntil: row.locked_until ? new Date(row.locked_until).toISOString() : undefined,
    channel: row.channel === "instagram" || row.channel === "facebook" ? row.channel : "whatsapp",
    externalContactId: row.external_contact_id || undefined,
  };
}

const conversationSelect = `
  SELECT c.*, a.name AS assigned_agent_name, lock_agent.name AS locked_by_name,
    NULLIF(TRIM(CONCAT(l.first_name, ' ', l.last_name)), '') AS lead_name
  FROM crm_whatsapp_conversations c
  LEFT JOIN agents a ON a.id = c.assigned_agent_id
  LEFT JOIN agents lock_agent ON lock_agent.id = c.locked_by
  LEFT JOIN crm_leads l ON l.id = c.lead_id
`;

export async function listWhatsAppConversations(options: { agentId: string; includeAll: boolean }) {
  await ensureWhatsAppInboxSchema();
  const sql = connection();
  try {
    const query = conversationSelect.replace("SELECT c.*,", "SELECT c.*, inbox.content AS last_message, inbox.created_at AS last_message_at,") + `
      JOIN LATERAL (SELECT content,created_at FROM crm_whatsapp_messages WHERE conversation_id=c.id
        AND status <> 'historical' AND (sender_type IN ('customer','ai','agent') OR status='cleared') ORDER BY created_at DESC,id DESC LIMIT 1) inbox ON TRUE
      WHERE ((c.channel='whatsapp' AND c.business_phone_number_id=$1) OR c.channel IN ('instagram','facebook'))
        AND ($2::boolean OR c.assigned_agent_id=$3::uuid)
      ORDER BY inbox.created_at DESC`;
    const rows=await sql.unsafe(query,[firstContactWhatsAppPhoneId(),options.includeAll,options.agentId]);
    return rows.map(mapConversation);
  } finally {await sql.end();}
}

export async function getWhatsAppConversation(id: string) {
  await ensureWhatsAppInboxSchema();
  const sql = connection();
  try {
    const rows = await sql.unsafe(`${conversationSelect} WHERE c.id = $1 LIMIT 1`, [id]);
    return rows[0] ? mapConversation(rows[0]) : null;
  } finally { await sql.end(); }
}

export async function ensureWhatsAppContact(phoneValue: string, contactName = "", businessPhoneNumberId?: string) {
  await ensureWhatsAppInboxSchema();
  const allowNewAi=(await getMiaAccess()).mode==='all';
  const phone = phoneValue.replace(/\D/g, "");
  const sql = connection();
  try {
    const identity=phoneIdentityVariants(phone);
    const id=await sql.begin(async tx=>{
      // Serialize competing webhook deliveries before searching or creating the lead.
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${'wa-contact:'+identity.key},0))`;
      // The Business App may echo +54 while Cloud API receives +549.
      // Reuse the same thread under the identity lock, preserving its routing number.
      const [existing]=await tx`SELECT phone FROM crm_whatsapp_conversations
        WHERE channel='whatsapp' AND phone=ANY(${identity.international}::text[])
          AND (business_phone_number_id=${businessPhoneNumberId||null} OR business_phone_number_id IS NULL)
        ORDER BY (business_phone_number_id=${businessPhoneNumberId||null}) DESC NULLS LAST,last_message_at DESC,id LIMIT 1`;
      const conversationPhone=existing?.phone||phone;
      let lead=await findContactLead(tx,conversationPhone);
      if(!lead){
        const parts=contactName.trim().split(/\s+/).filter(Boolean);
        const split=splitInternationalPhone('+'+phone);
        const created=await tx`INSERT INTO crm_leads(id,first_name,last_name,email,country_code,phone,status,source)
          VALUES(${crypto.randomUUID()},${parts.shift()||'Contacto'},${parts.join(' ')||'WhatsApp'},NULL,
            ${split.countryCode||'+54'},${split.phone||phone},'Nuevo','WhatsApp IA') RETURNING id,assigned_agent_id`;
        lead=created[0];
      }
      await tx`INSERT INTO crm_whatsapp_phone_aliases(phone_key,lead_id) VALUES(${identity.key},${lead.id}) ON CONFLICT(phone_key) DO NOTHING`;
      const rows=await tx`
        INSERT INTO crm_whatsapp_conversations (id,phone,contact_name,lead_id,business_phone_number_id,ai_enabled,assigned_agent_id,ai_assist_assigned)
        VALUES (${crypto.randomUUID()},${conversationPhone},${contactName.trim()},${lead.id},${businessPhoneNumberId||null},${allowNewAi&&businessPhoneNumberId!==WHATSAPP_TEST_PHONE_ID},${lead.assigned_agent_id||null},${allowNewAi&&Boolean(lead.assigned_agent_id)})
        ON CONFLICT(phone) DO UPDATE SET
          contact_name=COALESCE(NULLIF(EXCLUDED.contact_name,''),crm_whatsapp_conversations.contact_name),
          lead_id=EXCLUDED.lead_id,
          ai_enabled=CASE WHEN crm_whatsapp_conversations.business_phone_number_id IS NULL AND crm_whatsapp_conversations.id=md5('history-contact:'||crm_whatsapp_conversations.lead_id::text)::uuid THEN EXCLUDED.ai_enabled ELSE crm_whatsapp_conversations.ai_enabled END,
          ai_assist_assigned=CASE WHEN crm_whatsapp_conversations.business_phone_number_id IS NULL AND crm_whatsapp_conversations.id=md5('history-contact:'||crm_whatsapp_conversations.lead_id::text)::uuid THEN EXCLUDED.ai_assist_assigned ELSE crm_whatsapp_conversations.ai_assist_assigned END,
          assigned_agent_id=COALESCE(EXCLUDED.assigned_agent_id,crm_whatsapp_conversations.assigned_agent_id),
          business_phone_number_id=COALESCE(EXCLUDED.business_phone_number_id,crm_whatsapp_conversations.business_phone_number_id),updated_at=NOW()
        RETURNING id`;
      return rows[0].id;
    });
    return getWhatsAppConversation(id);
  } finally { await sql.end(); }
}

export async function ensureSocialContact(channel: "instagram" | "facebook", externalContactId: string, contactName = "", options: { enableAi?: boolean } = {}) {
  await ensureWhatsAppInboxSchema();
  const allowNewAi=(await getMiaAccess()).mode==='all';
  const sql = connection();
  try {
    const id = await sql.begin(async (tx) => {
      const rows = await tx`
        INSERT INTO crm_whatsapp_conversations (id, phone, contact_name, channel, external_contact_id, ai_enabled, ai_assist_assigned)
        VALUES (${crypto.randomUUID()}, ${`${channel}:${externalContactId}`}, ${contactName.trim() || (channel === "instagram" ? "Consulta de Instagram" : "Consulta de Facebook")}, ${channel}, ${externalContactId}, ${allowNewAi&&options.enableAi === true}, ${allowNewAi&&options.enableAi === true})
        ON CONFLICT (channel, external_contact_id) WHERE external_contact_id IS NOT NULL DO UPDATE SET
          contact_name = CASE WHEN ${contactName.trim()} <> '' THEN ${contactName.trim()} ELSE crm_whatsapp_conversations.contact_name END,
          updated_at = NOW()
        RETURNING id, lead_id, contact_name, assigned_agent_id
      `;
      const current = rows[0];
      if (!current.lead_id) {
        const profileName = contactName.trim() || await getMetaSocialContactName(channel, externalContactId);
        if (profileName) await tx`UPDATE crm_whatsapp_conversations SET contact_name = ${profileName} WHERE id = ${current.id}`;
        const result = await upsertCrmLeadByEmail({
          firstName: profileName || current.contact_name, lastName: "-",
          email: `${channel}-${externalContactId}@sin-email.barrerabrokers.local`,
          countryCode: "+54", phone: "", status: "Nuevo", source: channel === "instagram" ? "Instagram" : "Facebook",
          assignedAgentId: current.assigned_agent_id || undefined,
          notes: `Contacto recibido por ${channel === "instagram" ? "Instagram" : "Facebook"}. Todavía no informó teléfono ni correo.`,
        }, { preservePopulatedFields: true, leaveUnassignedOnCreate: true });
        if (!result.lead) throw new Error("No se pudo registrar el contacto de Meta.");
        await tx`UPDATE crm_whatsapp_conversations SET lead_id = ${result.lead.id}, assigned_agent_id = ${result.lead.assignedAgentId || current.assigned_agent_id || null} WHERE id = ${current.id}`;
      }
      return String(current.id);
    });
    return getWhatsAppConversation(id);
  } finally { await sql.end(); }
}

export async function listWhatsAppMessages(conversationId: string, limit: number | null = 100, beforeId?: string, inboxOnly = false) {
  await ensureWhatsAppInboxSchema();
  const sql = connection();
  try {
    const rows = await sql`
      SELECT m.*, a.name AS sender_name FROM crm_whatsapp_messages m
      LEFT JOIN agents a ON a.id = m.sender_agent_id
      WHERE m.conversation_id = ${conversationId}
        AND (${!inboxOnly} OR (m.status <> 'historical' AND (m.sender_type IN ('customer','ai','agent') OR m.status='cleared')))
        AND (${beforeId || null}::uuid IS NULL OR (m.created_at,m.id)<(SELECT created_at,id FROM crm_whatsapp_messages WHERE id=${beforeId || null}::uuid AND conversation_id=${conversationId}))
      ORDER BY m.created_at DESC,m.id DESC LIMIT ${limit === null ? null : Math.min(Math.max(limit, 1), 200)}
    `;
    return rows.reverse().map((row: any): WhatsAppMessage => ({
      id: row.id, conversationId: row.conversation_id, whatsappMessageId: row.whatsapp_message_id || undefined,
      direction: row.direction, senderType: row.sender_type, senderAgentId: row.sender_agent_id || undefined,
      senderName: row.sender_name || undefined, content: row.content, status: row.status, attachment: row.attachment || undefined,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  } finally { await sql.end(); }
}

export async function listWhatsAppMessagesForLead(leadId: string, phoneValue: string, limit: number | null = 6) {
  await ensureWhatsAppInboxSchema();
  const phone = phoneValue.replace(/\D/g, "");
  const sql = connection();
  try {
    const rows = await sql`
      SELECT m.*, a.name AS sender_name FROM crm_whatsapp_messages m
      INNER JOIN crm_whatsapp_conversations c ON c.id = m.conversation_id
      LEFT JOIN agents a ON a.id = m.sender_agent_id
      WHERE c.lead_id = ${leadId}
        OR (${phone} <> '' AND RIGHT(REGEXP_REPLACE(c.phone, '\\D', '', 'g'), 10) = RIGHT(${phone}, 10))
      ORDER BY m.created_at DESC LIMIT ${limit === null ? null : Math.min(Math.max(limit, 1), 30)}
    `;
    return rows.reverse().map((row: any): WhatsAppMessage => ({
      id: row.id, conversationId: row.conversation_id, whatsappMessageId: row.whatsapp_message_id || undefined,
      direction: row.direction, senderType: row.sender_type, senderAgentId: row.sender_agent_id || undefined,
      senderName: row.sender_name || undefined, content: row.content, status: row.status, attachment: row.attachment || undefined,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  } finally { await sql.end(); }
}

export async function saveWhatsAppMessage(data: {
  conversationId: string; whatsappMessageId?: string; direction: "inbound" | "outbound" | "unknown";
  senderType: "customer" | "ai" | "agent" | "history"; senderAgentId?: string; content: string; status?: string;
  createdAt?: string; historical?: boolean; attachment?: WhatsAppAttachment;
}) {
  await ensureWhatsAppInboxSchema();
  const sql = connection();
  const createdAt = data.createdAt || new Date().toISOString();
  try {
    return await sql.begin(async tx => {
      // Keep conversation → lead lock order consistent with Mía's commit and human controls.
      await tx`SELECT id FROM crm_whatsapp_conversations WHERE id=${data.conversationId} FOR UPDATE`;
      const rows = await tx`
        INSERT INTO crm_whatsapp_messages (id, conversation_id, whatsapp_message_id, direction, sender_type, sender_agent_id, content, status, created_at, attachment)
        VALUES (${crypto.randomUUID()}, ${data.conversationId}, ${data.whatsappMessageId || null}, ${data.direction}, ${data.senderType}, ${data.senderAgentId || null}, ${data.content}, ${data.status || "sent"}, ${createdAt}, ${data.attachment ? tx.json(data.attachment) : null})
        ON CONFLICT (whatsapp_message_id) DO NOTHING RETURNING id
      `;
      if (data.direction === "inbound") await persistWhatsAppLeadForm(tx, data.conversationId, data.content, data.whatsappMessageId || String(rows[0]?.id || ""), createdAt);
      if (!rows[0]) return false;
      await tx`
        UPDATE crm_whatsapp_conversations SET
          last_message = CASE WHEN last_message = '' OR last_message_at <= ${createdAt}::timestamptz THEN ${data.content} ELSE last_message END,
          last_message_at = CASE WHEN last_message = '' OR last_message_at <= ${createdAt}::timestamptz THEN ${createdAt}::timestamptz ELSE last_message_at END,
          unread_count = CASE WHEN ${data.direction} = 'inbound' AND ${!data.historical} THEN unread_count + 1 ELSE unread_count END,
          updated_at = NOW() WHERE id = ${data.conversationId}
      `;
      if(data.direction==='inbound'&&data.senderType==='customer'&&!data.historical&&data.status!=='historical')
        await notifyCompanyWhatsAppReply(tx,data.conversationId,data.whatsappMessageId||String(rows[0].id));
      if(!data.historical&&data.status!=="historical"&&data.status!=="cleared"&&data.direction!=="unknown")await recordMiaSalesWhatsAppInteraction(tx,{conversationId:data.conversationId,messageId:data.whatsappMessageId||String(rows[0].id),direction:data.direction,content:data.content,ai:data.senderType==="ai"});
      return true;
    });
  } finally { await sql.end(); }
}

// Meta read receipts are matched to the exact outbound message and business number.
export async function recordWhatsAppRead(messageId:string,businessPhoneNumberId:string) {
 if(!messageId||!businessPhoneNumberId)return false;
 await ensureWhatsAppInboxSchema();
 const sql=connection();
 try {
  const rows=await sql`UPDATE crm_whatsapp_messages m SET status='read' FROM crm_whatsapp_conversations c
    WHERE m.conversation_id=c.id AND m.whatsapp_message_id=${messageId} AND m.direction='outbound'
    AND c.business_phone_number_id=${businessPhoneNumberId} AND m.status NOT IN ('read','failed','error') RETURNING m.id`;
  return rows.length>0;
 }finally{await sql.end();}
}

export async function updateWhatsAppConversation(id: string, data: {
  assignedAgentId?: string | null; aiEnabled?: boolean; aiAssistAssigned?:boolean; status?: "open" | "closed";
  ownerActorId?: string; lockAgentId?: string; markRead?: boolean;
}) {
  await ensureWhatsAppInboxSchema();
  const sql = connection();
  try {
    await sql.begin(async tx => {
    const access=await getMiaAccess(tx);
    if((data.aiEnabled===true||data.aiAssistAssigned===true)&&!miaAccessAllows(access,id))throw new Error('Mía está en modo de prueba: solo está autorizada la conversación con Pablo Barrera.');
    await tx`SELECT set_config('crm.owner_actor_id', ${data.ownerActorId || data.lockAgentId || ""}, true)`;
    if (data.lockAgentId) {
      const locked = await tx`
        UPDATE crm_whatsapp_conversations SET locked_by = ${data.lockAgentId}, locked_until = NOW() + INTERVAL '2 minutes',
          assigned_agent_id = COALESCE(assigned_agent_id, ${data.lockAgentId}), ai_enabled = CASE WHEN ${access.manualPause===true} THEN ai_enabled ELSE FALSE END, updated_at = NOW()
        WHERE id = ${id} AND (reply_send_token IS NULL OR locked_until<NOW()) AND (locked_by IS NULL OR locked_by = ${data.lockAgentId} OR locked_until < NOW()) RETURNING id
      `;
      if (!locked[0]) throw new Error("Otro agente está atendiendo esta conversación.");
      await tx`
        UPDATE crm_leads SET assigned_agent_id = (SELECT assigned_agent_id FROM crm_whatsapp_conversations WHERE id = ${id}), updated_at = NOW()
        WHERE id = (SELECT lead_id FROM crm_whatsapp_conversations WHERE id = ${id})
      `;
    }
    if (data.assignedAgentId !== undefined) {
      await tx`UPDATE crm_whatsapp_conversations SET assigned_agent_id = ${data.assignedAgentId}, locked_by = NULL, locked_until = NULL, updated_at = NOW() WHERE id = ${id}`;
      await tx`UPDATE crm_leads SET assigned_agent_id = ${data.assignedAgentId}, updated_at = NOW() WHERE id = (SELECT lead_id FROM crm_whatsapp_conversations WHERE id = ${id})`;
    }
    if (data.aiEnabled !== undefined) await tx`UPDATE crm_whatsapp_conversations SET ai_enabled = ${data.aiEnabled}, updated_at = NOW() WHERE id = ${id}`;
    if(data.aiAssistAssigned!==undefined)await tx`UPDATE crm_whatsapp_conversations SET ai_assist_assigned=${data.aiAssistAssigned},updated_at=NOW() WHERE id=${id}`;
    if (data.status) await tx`UPDATE crm_whatsapp_conversations SET status = ${data.status}, updated_at = NOW() WHERE id = ${id}`;
    if (data.markRead) await tx`UPDATE crm_whatsapp_conversations SET unread_count = 0, updated_at = NOW() WHERE id = ${id}`;
    });
    return getWhatsAppConversation(id);
  } finally { await sql.end(); }
}

export function verifyWhatsAppSignature(rawBody: string, signature: string | null) {
  const secret = getWhatsAppAppSecret();
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function sendWhatsAppText(phone: string, text: string, businessPhoneNumberId?: string) {
  const saved = await getWhatsAppChannelCredentials();
  const token = process.env.WHATSAPP_ACCESS_TOKEN || saved?.accessToken || process.env.META_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || saved?.phoneNumberId;
  const sender = selectWhatsAppSender(businessPhoneNumberId, { token, phoneNumberId }, process.env.WHATSAPP_TEST_ACCESS_TOKEN);
  return deliverWhatsAppText(sender, phone, text, process.env.WHATSAPP_GRAPH_VERSION || "v23.0");
}

export async function sendWhatsAppAttachment(phone:string,file:File,attachment:WhatsAppAttachment,caption='',businessPhoneNumberId?:string) {
  const saved=await getWhatsAppChannelCredentials();
  const token=process.env.WHATSAPP_ACCESS_TOKEN||saved?.accessToken||process.env.META_ACCESS_TOKEN;
  const phoneNumberId=process.env.WHATSAPP_PHONE_NUMBER_ID||saved?.phoneNumberId;
  const sender=selectWhatsAppSender(businessPhoneNumberId,{token,phoneNumberId},process.env.WHATSAPP_TEST_ACCESS_TOKEN);
  return deliverWhatsAppAttachment(sender,phone,file,attachment,caption,process.env.WHATSAPP_GRAPH_VERSION||'v23.0');
}

export async function sendMetaSocialText(channel: "instagram" | "facebook", recipientId: string, text: string) {
  return deliverMetaSocialText(channel, await getMetaSocialCredentials(), recipientId, text, process.env.META_GRAPH_VERSION || 'v26.0');
}

export function shouldEscalateConversation(text: string) {
  return requestsHuman(text);
}

async function loadWhatsAppLeadContext(conversationId?: string): Promise<Record<string, unknown>> {
  if (!conversationId) return {};
  const sql = connection();
  try {
    const [row] = await sql`SELECT c.channel, c.contact_name, l.first_name, l.last_name, l.email, l.development_name_text,
      l.meta_properties, d.name AS development_name FROM crm_whatsapp_conversations c
      LEFT JOIN crm_leads l ON l.id = c.lead_id LEFT JOIN developments d ON d.id = l.development_id
      WHERE c.id = ${conversationId} LIMIT 1`;
    if (!row) return {};
    const properties = row.meta_properties || {};
    const fields = Object.fromEntries(Object.entries(properties).filter(([key]) => key.startsWith("meta_field_") || ["meta_form_name", "meta_campaign_name", "meta_ad_name", "meta_created_time"].includes(key)).slice(0, 40).map(([key,value])=>[key, String(value || "").slice(0,1000)]));
    return { channel: row.channel, nombre: [row.first_name, row.last_name].filter(Boolean).join(" ") || row.contact_name,
      email: row.email?.endsWith(".barrerabrokers.local") ? undefined : row.email,
      desarrollo: row.development_name || row.development_name_text || undefined, formularioMeta: fields };
  } finally { await sql.end(); }
}

export async function generateWhatsAppAiReply(messages: WhatsAppMessage[]): Promise<string | null> {
  const id = messages[0]?.conversationId;
  if (!id || !miaAccessAllows(await getMiaAccess(), id)) return null;
  const history = await listWhatsAppMessages(id, null);
  const contact = await getWhatsAppConversation(id);
  if (!contact) return null;
  if (contact.channel !== 'whatsapp') return generateMiaResetReply(id, history, () => loadWhatsAppLeadContext(id));
  const profile = await loadWhatsAppLeadContext(id);
  const email = typeof profile.email === 'string' ? profile.email : '';
  if (!newMiaEngineAllows(contact.phone, email, {
    MIA_NEW_ENGINE_ENABLED: process.env.MIA_NEW_ENGINE_ENABLED,
    MIA_TEST_NUMBERS: process.env.MIA_TEST_NUMBERS,
    MIA_TEST_EMAILS: process.env.MIA_TEST_EMAILS,
  })) return null;
  if (!contact.aiEnabled || contact.status === 'closed') return null;
  const activeHistory = history.filter(message => !['historical', 'cleared'].includes(message.status));
  const inbound = activeHistory.at(-1);
  if (inbound?.direction !== 'inbound') return null;
  const previousReply = activeHistory.findLast(message => message.direction === 'outbound')?.content ?? '';
  const closingAfterBooking = previousReply.startsWith('Listo, reunión coordinada') && socialClosing(inbound.content);
  if (!closingAfterBooking && routesToMiaMeeting(inbound.content, previousReply)) {
    const meeting = await replyMiaMeeting(id, activeHistory).catch(error => {
      console.warn('mia-pilot-meeting-route-failed', {name: error instanceof Error ? error.name : 'unknown'});
      return null;
    });
    if (meeting) {
      if (asksMeetingStatus(inbound.content) || /^(?:Listo, reunión (?:coordinada|reprogramada)|Un agente te confirma el horario en el día)/.test(meeting.reply)) {
        return repeatsLastMessage(meeting.reply, previousReply) ? null : meeting.reply;
      }
      const reply = meeting.reply.includes('?') ? meeting.reply : meeting.reply + ' ¿Querés que te ayude con algo más?';
      const questions = reply.replace(/https?:\/\/\S+/g, '').match(/\?/g) ?? [];
      if (repeatsLastMessage(reply, previousReply) || questions.length !== 1 || reply.split('\n').length > 3) return null;
      return reply;
    }
    if (meetingIntent(inbound.content)) {
      const pending = 'Un agente te confirma el horario en el día.';
      return repeatsLastMessage(pending, previousReply) ? null : pending;
    }
    if (/^(?:si|sí)(?:[, ]+confirmad[oa])?[.! ]*$|^(?:dale|ok|perfecto|confirmo)[.! ]*$/i.test(inbound.content.trim())) return null;
  }
  return generateMiaWhatsAppReply(contact, history);
}
