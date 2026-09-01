import crypto from "crypto";
import postgres from "postgres";
import { splitInternationalPhone } from "@/lib/phone-countries";
import { upsertCrmLead } from "@/lib/db";

export type WhatsAppConversation = {
  id: string;
  phone: string;
  contactName: string;
  leadId?: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  aiEnabled: boolean;
  status: "open" | "closed";
  unreadCount: number;
  lastMessage: string;
  lastMessageAt: string;
  lockedBy?: string;
  lockedByName?: string;
  lockedUntil?: string;
};

export type WhatsAppMessage = {
  id: string;
  conversationId: string;
  whatsappMessageId?: string;
  direction: "inbound" | "outbound";
  senderType: "customer" | "ai" | "agent";
  senderAgentId?: string;
  senderName?: string;
  content: string;
  status: string;
  createdAt: string;
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
        CREATE INDEX IF NOT EXISTS idx_wa_conversations_owner ON crm_whatsapp_conversations(assigned_agent_id, last_message_at DESC);
        CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation ON crm_whatsapp_messages(conversation_id, created_at);
      `);
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
    contactName: row.contact_name || row.lead_name || row.phone,
    leadId: row.lead_id || undefined,
    assignedAgentId: row.assigned_agent_id || undefined,
    assignedAgentName: row.assigned_agent_name || undefined,
    aiEnabled: Boolean(row.ai_enabled),
    status: row.status === "closed" ? "closed" : "open",
    unreadCount: Number(row.unread_count || 0),
    lastMessage: row.last_message || "",
    lastMessageAt: new Date(row.last_message_at).toISOString(),
    lockedBy: row.locked_by || undefined,
    lockedByName: row.locked_by_name || undefined,
    lockedUntil: row.locked_until ? new Date(row.locked_until).toISOString() : undefined,
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
    const rows = options.includeAll
      ? await sql.unsafe(`${conversationSelect} ORDER BY c.last_message_at DESC`)
      : await sql.unsafe(`${conversationSelect} WHERE c.assigned_agent_id = $1 ORDER BY c.last_message_at DESC`, [options.agentId]);
    return rows.map(mapConversation);
  } finally { await sql.end(); }
}

export async function getWhatsAppConversation(id: string) {
  await ensureWhatsAppInboxSchema();
  const sql = connection();
  try {
    const rows = await sql.unsafe(`${conversationSelect} WHERE c.id = $1 LIMIT 1`, [id]);
    return rows[0] ? mapConversation(rows[0]) : null;
  } finally { await sql.end(); }
}

export async function ensureWhatsAppContact(phoneValue: string, contactName = "") {
  await ensureWhatsAppInboxSchema();
  const phone = phoneValue.replace(/\D/g, "");
  const sql = connection();
  try {
    let leadRows = await sql`
      SELECT id FROM crm_leads
      WHERE RIGHT(REGEXP_REPLACE(COALESCE(country_code, '') || COALESCE(phone, ''), '\\D', '', 'g'), 10) = RIGHT(${phone}, 10)
      LIMIT 1
    `;
    let leadId = leadRows[0]?.id as string | undefined;
    if (!leadId) {
      const parts = contactName.trim().split(/\s+/).filter(Boolean);
      const firstName = parts.shift() || "Contacto";
      const lastName = parts.join(" ") || "WhatsApp";
      const split = splitInternationalPhone(`+${phone}`);
      const result = await upsertCrmLead({
        firstName,
        lastName,
        email: `whatsapp-${phone}@sin-email.barrerabrokers.local`,
        countryCode: split.countryCode || "+54",
        phone: split.phone || phone,
        status: "NEW",
        source: "WhatsApp IA",
        assignedAgentId: undefined,
      });
      leadId = result.lead?.id;
    }
    const rows = await sql`
      INSERT INTO crm_whatsapp_conversations (id, phone, contact_name, lead_id)
      VALUES (${crypto.randomUUID()}, ${phone}, ${contactName.trim()}, ${leadId || null})
      ON CONFLICT (phone) DO UPDATE SET
        contact_name = COALESCE(NULLIF(EXCLUDED.contact_name, ''), crm_whatsapp_conversations.contact_name),
        lead_id = COALESCE(crm_whatsapp_conversations.lead_id, EXCLUDED.lead_id),
        updated_at = NOW()
      RETURNING id
    `;
    return getWhatsAppConversation(rows[0].id);
  } finally { await sql.end(); }
}

export async function listWhatsAppMessages(conversationId: string, limit = 100) {
  await ensureWhatsAppInboxSchema();
  const sql = connection();
  try {
    const rows = await sql`
      SELECT m.*, a.name AS sender_name FROM crm_whatsapp_messages m
      LEFT JOIN agents a ON a.id = m.sender_agent_id
      WHERE m.conversation_id = ${conversationId}
      ORDER BY m.created_at DESC LIMIT ${Math.min(Math.max(limit, 1), 200)}
    `;
    return rows.reverse().map((row: any): WhatsAppMessage => ({
      id: row.id, conversationId: row.conversation_id, whatsappMessageId: row.whatsapp_message_id || undefined,
      direction: row.direction, senderType: row.sender_type, senderAgentId: row.sender_agent_id || undefined,
      senderName: row.sender_name || undefined, content: row.content, status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  } finally { await sql.end(); }
}

export async function listWhatsAppMessagesForLead(leadId: string, phoneValue: string, limit = 6) {
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
      ORDER BY m.created_at DESC LIMIT ${Math.min(Math.max(limit, 1), 30)}
    `;
    return rows.reverse().map((row: any): WhatsAppMessage => ({
      id: row.id, conversationId: row.conversation_id, whatsappMessageId: row.whatsapp_message_id || undefined,
      direction: row.direction, senderType: row.sender_type, senderAgentId: row.sender_agent_id || undefined,
      senderName: row.sender_name || undefined, content: row.content, status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  } finally { await sql.end(); }
}

export async function saveWhatsAppMessage(data: {
  conversationId: string; whatsappMessageId?: string; direction: "inbound" | "outbound";
  senderType: "customer" | "ai" | "agent"; senderAgentId?: string; content: string; status?: string;
}) {
  await ensureWhatsAppInboxSchema();
  const sql = connection();
  try {
    const rows = await sql`
      INSERT INTO crm_whatsapp_messages (id, conversation_id, whatsapp_message_id, direction, sender_type, sender_agent_id, content, status)
      VALUES (${crypto.randomUUID()}, ${data.conversationId}, ${data.whatsappMessageId || null}, ${data.direction}, ${data.senderType}, ${data.senderAgentId || null}, ${data.content}, ${data.status || "sent"})
      ON CONFLICT (whatsapp_message_id) DO NOTHING RETURNING id
    `;
    if (!rows[0]) return false;
    await sql`
      UPDATE crm_whatsapp_conversations SET last_message = ${data.content}, last_message_at = NOW(),
        unread_count = CASE WHEN ${data.direction} = 'inbound' THEN unread_count + 1 ELSE unread_count END,
        updated_at = NOW() WHERE id = ${data.conversationId}
    `;
    return true;
  } finally { await sql.end(); }
}

export async function updateWhatsAppConversation(id: string, data: {
  assignedAgentId?: string | null; aiEnabled?: boolean; status?: "open" | "closed";
  lockAgentId?: string; markRead?: boolean;
}) {
  await ensureWhatsAppInboxSchema();
  const sql = connection();
  try {
    if (data.lockAgentId) {
      const locked = await sql`
        UPDATE crm_whatsapp_conversations SET locked_by = ${data.lockAgentId}, locked_until = NOW() + INTERVAL '2 minutes',
          assigned_agent_id = COALESCE(assigned_agent_id, ${data.lockAgentId}), ai_enabled = FALSE, updated_at = NOW()
        WHERE id = ${id} AND (locked_by IS NULL OR locked_by = ${data.lockAgentId} OR locked_until < NOW()) RETURNING id
      `;
      if (!locked[0]) throw new Error("Otro agente está atendiendo esta conversación.");
      await sql`
        UPDATE crm_leads SET assigned_agent_id = ${data.lockAgentId}, updated_at = NOW()
        WHERE id = (SELECT lead_id FROM crm_whatsapp_conversations WHERE id = ${id})
      `;
    }
    if (data.assignedAgentId !== undefined) {
      await sql`UPDATE crm_whatsapp_conversations SET assigned_agent_id = ${data.assignedAgentId}, locked_by = NULL, locked_until = NULL, updated_at = NOW() WHERE id = ${id}`;
      await sql`UPDATE crm_leads SET assigned_agent_id = ${data.assignedAgentId}, updated_at = NOW() WHERE id = (SELECT lead_id FROM crm_whatsapp_conversations WHERE id = ${id})`;
    }
    if (data.aiEnabled !== undefined) await sql`UPDATE crm_whatsapp_conversations SET ai_enabled = ${data.aiEnabled}, updated_at = NOW() WHERE id = ${id}`;
    if (data.status) await sql`UPDATE crm_whatsapp_conversations SET status = ${data.status}, updated_at = NOW() WHERE id = ${id}`;
    if (data.markRead) await sql`UPDATE crm_whatsapp_conversations SET unread_count = 0, updated_at = NOW() WHERE id = ${id}`;
    return getWhatsAppConversation(id);
  } finally { await sql.end(); }
}

export function verifyWhatsAppSignature(rawBody: string, signature: string | null) {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function sendWhatsAppText(phone: string, text: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error("Faltan las credenciales oficiales de WhatsApp.");
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: phone, type: "text", text: { preview_url: false, body: text } }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message || "WhatsApp rechazó el mensaje.");
  return result?.messages?.[0]?.id as string | undefined;
}

export async function generateWhatsAppAiReply(messages: WhatsAppMessage[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Falta OPENAI_API_KEY.");
  const input = messages.slice(-20).map((message) => ({
    role: message.direction === "inbound" ? "user" : "assistant",
    content: message.content,
  }));
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_WHATSAPP_MODEL || "gpt-5.4",
      store: false,
      max_output_tokens: 350,
      instructions: process.env.WHATSAPP_AI_INSTRUCTIONS || `Sos el asistente comercial de Barrera Brokers. Respondé en español rioplatense, con mensajes breves y amables. Tu objetivo es entender si busca comprar, vender o invertir; zona, presupuesto, ambientes y plazo. No inventes propiedades, precios, disponibilidad, rentabilidad ni condiciones. Si falta información real, decí que un asesor lo confirmará. Pedí nombre y email si aún no figuran. Cuando solicite una persona, visita, negociación o información sensible, indicá que lo derivás al equipo. Nunca brindes asesoramiento legal o financiero definitivo.`,
      input,
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message || "No se pudo generar la respuesta de IA.");
  const text = result.output_text || result.output?.flatMap((item: any) => item.content || []).find((item: any) => item.type === "output_text")?.text;
  if (!text) throw new Error("La IA no devolvió una respuesta.");
  return String(text).trim();
}
