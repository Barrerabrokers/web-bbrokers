import { validateMiaSources, type MiaSources, EMPTY_MIA_SOURCES } from '@/lib/whatsapp-mia-sources-config';
import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
import { DEFAULT_WHATSAPP_WELCOME } from '@/lib/whatsapp-welcome-only';
/** The approved welcome is defined in code; CRM settings cannot override it. */
export async function getMiaWelcomeTemplate(): Promise<string> {
  return DEFAULT_WHATSAPP_WELCOME;
}

async function ensureMiaSettings() {
  const sql = getSharedDatabase();
  try { await sql`CREATE TABLE IF NOT EXISTS crm_whatsapp_agent_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`; }
  finally { await releaseSharedDatabase(sql); }
}

export type MiaOptions = { advisor: string; catalog: string };
export const DEFAULT_MIA_OPTIONS: MiaOptions = {
  advisor: 'El cliente quiere hablar con un asesor. Dejar la atención pendiente para el equipo, sin prometer un horario ni una llamada confirmada.',
  catalog: 'Presentar los desarrollos y proyectos del catálogo vigente. Preguntar qué zona o tipo de producto le interesa si todavía no lo sabemos. Enviar únicamente información y brochures verificados. Nunca informar valores ni listas de precios; derivar esas consultas a un asesor.',
};
export function validateMiaOptions(value: unknown): MiaOptions {
  if (!value || typeof value !== 'object') throw new Error('Completá la información de las dos opciones.');
  const options = value as Record<string, unknown>;
  for (const key of ['advisor', 'catalog']) {
    if (typeof options[key] !== 'string' || !(options[key] as string).trim() || (options[key] as string).length > 6000)
      throw new Error('Cada opción debe tener entre 1 y 6000 caracteres.');
  }
  return { advisor: (options.advisor as string).trim(), catalog: (options.catalog as string).trim() };
}
export async function getMiaOptions(): Promise<MiaOptions> {
  await ensureMiaSettings();
  const sql = getSharedDatabase();
  try {
    const [row] = await sql`SELECT value FROM crm_whatsapp_agent_settings WHERE key='mia-options-v1'`;
    return row ? validateMiaOptions(JSON.parse(row.value)) : { ...DEFAULT_MIA_OPTIONS };
  } finally { await releaseSharedDatabase(sql); }
}
export async function getMiaSources(): Promise<MiaSources> {
  await ensureMiaSettings();
  const sql = getSharedDatabase();
  try {
    const [row] = await sql`SELECT value FROM crm_whatsapp_agent_settings WHERE key='mia-sources-v1'`;
    return row ? validateMiaSources(JSON.parse(row.value)) : { ...EMPTY_MIA_SOURCES };
  } finally { await releaseSharedDatabase(sql); }
}

export async function saveMiaSources(value: unknown) {
  const sources = validateMiaSources(value);
  await ensureMiaSettings();
  const sql = getSharedDatabase();
  try {
    await sql`INSERT INTO crm_whatsapp_agent_settings(key,value) VALUES('mia-sources-v1',${JSON.stringify(sources)}) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`;
  } finally { await releaseSharedDatabase(sql); }
  return { sources };
}
