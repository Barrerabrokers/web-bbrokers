import postgres from "postgres";

export type CrmAiContact = { id: string; name: string; email: string; development: string };
export type CrmAiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  contacts: CrmAiContact[];
  createdAt: string;
};
export type CrmAiConversation = {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

function connection() {
  const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("No database connection URL found");
  return postgres(url, { ssl: "require", max: 1, prepare: false });
}

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;
async function ensureSchema() {
  if (schemaReady) return;
  if (!schemaPromise) schemaPromise = (async () => {
    let sql: ReturnType<typeof connection> | null = null;
    try {
      sql = connection();
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS crm_ai_conversations (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS crm_ai_messages (
          id UUID PRIMARY KEY,
          conversation_id UUID NOT NULL REFERENCES crm_ai_conversations(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
          content TEXT NOT NULL,
          contacts JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_crm_ai_conversations_user_updated ON crm_ai_conversations(user_id, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_crm_ai_messages_conversation_created ON crm_ai_messages(conversation_id, created_at ASC);
      `);
      schemaReady = true;
    } finally {
      await sql?.end().catch(() => undefined);
      if (!schemaReady) schemaPromise = null;
    }
  })();
  await schemaPromise;
}

export async function listCrmAiConversations(userId: string): Promise<CrmAiConversation[]> {
  await ensureSchema();
  const sql = connection();
  try {
    const rows = await sql`
      SELECT c.id, c.title, c.created_at, c.updated_at,
        COUNT(m.id)::int AS message_count,
        COALESCE((SELECT content FROM crm_ai_messages lm WHERE lm.conversation_id = c.id ORDER BY lm.created_at DESC LIMIT 1), '') AS preview
      FROM crm_ai_conversations c
      LEFT JOIN crm_ai_messages m ON m.conversation_id = c.id
      WHERE c.user_id = ${userId}
      GROUP BY c.id
      ORDER BY c.updated_at DESC
      LIMIT 100
    `;
    return rows.map((row) => ({ id: String(row.id), title: String(row.title), preview: String(row.preview), messageCount: Number(row.message_count), createdAt: new Date(row.created_at as string).toISOString(), updatedAt: new Date(row.updated_at as string).toISOString() }));
  } finally { await sql.end(); }
}

export async function getCrmAiConversation(conversationId: string, userId: string) {
  await ensureSchema();
  const sql = connection();
  try {
    const conversations = await sql`SELECT id, title, created_at, updated_at FROM crm_ai_conversations WHERE id = ${conversationId} AND user_id = ${userId} LIMIT 1`;
    if (!conversations[0]) return null;
    const messages = await sql`SELECT id, role, content, contacts, created_at FROM crm_ai_messages WHERE conversation_id = ${conversationId} ORDER BY created_at ASC`;
    return {
      id: String(conversations[0].id), title: String(conversations[0].title), createdAt: new Date(conversations[0].created_at as string).toISOString(), updatedAt: new Date(conversations[0].updated_at as string).toISOString(),
      messages: messages.map((row) => ({ id: String(row.id), role: row.role as "user" | "assistant", content: String(row.content), contacts: Array.isArray(row.contacts) ? row.contacts as CrmAiContact[] : [], createdAt: new Date(row.created_at as string).toISOString() } satisfies CrmAiMessage)),
    };
  } finally { await sql.end(); }
}

export async function createCrmAiConversation(userId: string, title: string) {
  await ensureSchema();
  const sql = connection();
  try {
    const id = crypto.randomUUID();
    await sql`INSERT INTO crm_ai_conversations (id, user_id, title) VALUES (${id}, ${userId}, ${title})`;
    return id;
  } finally { await sql.end(); }
}

export async function appendCrmAiExchange(conversationId: string, userId: string, question: string, answer: string, contacts: CrmAiContact[]) {
  await ensureSchema();
  const sql = connection();
  try {
    await sql.begin(async (transaction) => {
      const owned = await transaction`UPDATE crm_ai_conversations SET updated_at = NOW() WHERE id = ${conversationId} AND user_id = ${userId} RETURNING id`;
      if (!owned[0]) throw new Error("Conversación no encontrada");
      await transaction`INSERT INTO crm_ai_messages (id, conversation_id, role, content) VALUES (${crypto.randomUUID()}, ${conversationId}, 'user', ${question})`;
      await transaction`INSERT INTO crm_ai_messages (id, conversation_id, role, content, contacts) VALUES (${crypto.randomUUID()}, ${conversationId}, 'assistant', ${answer}, ${transaction.json(contacts)})`;
    });
  } finally { await sql.end(); }
}

export async function deleteCrmAiConversation(conversationId: string, userId: string) {
  await ensureSchema();
  const sql = connection();
  try {
    const rows = await sql`DELETE FROM crm_ai_conversations WHERE id = ${conversationId} AND user_id = ${userId} RETURNING id`;
    return Boolean(rows[0]);
  } finally { await sql.end(); }
}
