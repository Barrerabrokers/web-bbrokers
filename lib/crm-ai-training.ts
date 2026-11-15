import { randomUUID } from 'crypto';
import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
import type { AiTrainingExample } from '@/lib/crm-ai-training-prompt';
let schemaPromise: Promise<void> | undefined;
async function ensureSchema() {
  if (!schemaPromise) schemaPromise = (async () => {
    const sql = getSharedDatabase();
    try { await sql`CREATE TABLE IF NOT EXISTS crm_ai_training (id UUID PRIMARY KEY, question TEXT NOT NULL, answer TEXT NOT NULL, context TEXT NOT NULL DEFAULT '', enabled BOOLEAN NOT NULL DEFAULT TRUE, expires_at TIMESTAMPTZ, created_by UUID NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`; }
    finally { await releaseSharedDatabase(sql); }
  })().catch(error => { schemaPromise = undefined; throw error; });
  await schemaPromise;
}
export async function listAiTraining(): Promise<AiTrainingExample[]> {
  await ensureSchema(); const sql = getSharedDatabase();
  try { const rows = await sql`SELECT id, question, answer, context, enabled, expires_at FROM crm_ai_training ORDER BY updated_at DESC LIMIT 200`;
    return rows.map(r => ({id: r.id, question: r.question, answer: r.answer, context: r.context, enabled: r.enabled, expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null}));
  } finally { await releaseSharedDatabase(sql); }
}
export async function saveAiTraining(input: Omit<AiTrainingExample, 'id'> & {id?: string}, actor: string) {
  await ensureSchema(); const sql = getSharedDatabase();
  try {
    if (input.id) { const rows = await sql`UPDATE crm_ai_training SET question=${input.question}, answer=${input.answer}, context=${input.context}, enabled=${input.enabled}, expires_at=${input.expiresAt}, updated_at=NOW() WHERE id=${input.id} RETURNING id`; if (!rows.length) throw new Error('Ejemplo inexistente'); }
    else { await sql.begin(async tx => { await tx`SELECT pg_advisory_xact_lock(74102604)`; const [row] = await tx`SELECT COUNT(*)::int AS count FROM crm_ai_training`; if (row.count >= 200) throw new Error('Llegaste a 200 ejemplos. Eliminá uno para agregar otro.'); await tx`INSERT INTO crm_ai_training (id,question,answer,context,enabled,expires_at,created_by) VALUES (${randomUUID()},${input.question},${input.answer},${input.context},${input.enabled},${input.expiresAt},${actor})`; }); }
  } finally { await releaseSharedDatabase(sql); }
}
export async function deleteAiTraining(id: string) {
  await ensureSchema(); const sql = getSharedDatabase();
  try { await sql`DELETE FROM crm_ai_training WHERE id=${id}`; } finally { await releaseSharedDatabase(sql); }
}
