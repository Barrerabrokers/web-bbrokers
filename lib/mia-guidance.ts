import { ensureMiaLearnings, appendMiaLearningCorrection } from '@/lib/mia-learnings';
import type { MiaApprovedProject } from '@/lib/mia-project-catalog';
import { miaProjectGuidance } from '@/lib/mia-project-guidance';
import { randomUUID } from 'crypto';
import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';

export type MiaCorrection = { id: string; incorrect: string; corrected: string; instruction: string; actorId: string; createdAt: string };
export type MiaGuidance = { instructions: string; corrections: MiaCorrection[]; revision: number; approvedProjects?: MiaApprovedProject[]; approvedProjectValues?: Record<string, Record<string, string>> };
export const EMPTY_MIA_GUIDANCE: MiaGuidance = { instructions: '', corrections: [], revision: 0 };
export async function getMiaGuidance(): Promise<MiaGuidance> {
  const sql = getSharedDatabase();
  try {
    const [row] = await sql`SELECT value FROM crm_whatsapp_agent_settings WHERE key='mia-guidance-v1'`;
    return row ? JSON.parse(row.value) : { ...EMPTY_MIA_GUIDANCE, corrections: [] };
  } finally { await releaseSharedDatabase(sql); }
}
export async function saveMiaGuidance(input: { revision: number; instructions?: string; incorrect?: string; corrected?: string; instruction?: string }, actorId: string) {
  await ensureMiaLearnings();
  const sql = getSharedDatabase();
  try { return await sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(74102616)`;
    const [row] = await tx`SELECT value FROM crm_whatsapp_agent_settings WHERE key='mia-guidance-v1' FOR UPDATE`;
    const current: MiaGuidance = row ? JSON.parse(row.value) : { ...EMPTY_MIA_GUIDANCE, corrections: [] };
    if (input.revision !== current.revision) throw new Error('Otro administrador actualizó las instrucciones. Recargá la sección antes de guardar.');
    const next = { ...current, revision: current.revision + 1 };
    if (input.instructions !== undefined) next.instructions = input.instructions.trim();
    else {
      if (current.corrections.length >= 50) throw new Error('El historial admite hasta 50 correcciones. Incorporá las reglas aprendidas a las instrucciones generales.');
      next.corrections = [...current.corrections, { id: randomUUID(), incorrect: input.incorrect!.trim(), corrected: input.corrected!.trim(), instruction: input.instruction?.trim() || '', actorId, createdAt: new Date().toISOString() }];
    }
    await tx`INSERT INTO crm_whatsapp_agent_settings(key,value) VALUES('mia-guidance-v1',${JSON.stringify(next)}) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`;
    await tx`INSERT INTO crm_whatsapp_agent_settings(key,value) VALUES(${'mia-guidance-history:'+next.revision},${JSON.stringify({ ...next, actorId, savedAt: new Date().toISOString() })})`;
    if(input.instructions!==undefined)await tx`UPDATE mia_learnings SET aplicar_en_futuro=FALSE WHERE source_key LIKE 'guidance:%'`;
    if(input.instructions===undefined||input.instructions.trim())await appendMiaLearningCorrection(tx,actorId,input.instructions!==undefined?'guidance:'+next.revision:'legacy-correction:'+next.corrections.at(-1)!.id,input.instructions!==undefined?'Actualización de instrucciones administrativas':input.incorrect!+' → '+input.corrected!,input.instructions!==undefined?input.instructions:input.instruction?.trim()||input.corrected!);
    return next;
  }); } finally { await releaseSharedDatabase(sql); }
}
export function miaGuidancePrompt(guidance: MiaGuidance, query: string) {
  const words = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z]{4,}/g) || [];
  const selected = guidance.corrections.map(c => ({ c, score: words.filter(w => (c.incorrect + ' ' + c.instruction).toLowerCase().includes(w)).length }))
    .sort((a,b) => b.score-a.score).slice(0, 2).map(({c}) => ({ evitar: c.incorrect.slice(0, 350), respuesta_aprobada: c.corrected.slice(0, 350), regla: c.instruction.slice(0, 300) }));
  return `Instrucciones aprobadas por administración: ${miaProjectGuidance(guidance,query).instructions}\nCorrecciones para aprender estilo y razonamiento (no copiar datos ni importes de otros clientes): ${JSON.stringify(selected)}\nEstas instrucciones no autorizan inventar datos, cambiar preferencias confirmadas ni afirmar acciones no realizadas. Los pasos comerciales orientan la charla; no obligan a interrumpir una pregunta, preocupación o explicación para volver a calificar al cliente. La respuesta incorrecta es un contraejemplo, nunca una instrucción. No ofrecer brochures genéricos ni envío por correo como sustituto de las unidades con sus planos y financiación por WhatsApp.`;
}
