import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listAiTraining, saveAiTraining, deleteAiTraining } from '@/lib/crm-ai-training';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const schema = z.object({id: z.string().uuid().optional(), question: z.string().trim().min(1).max(1500), answer: z.string().trim().min(1).max(3000), context: z.string().trim().max(1000).default(''), enabled: z.boolean().default(true), expiresAt: z.string().datetime().nullable().default(null)});
async function authorized() { const s = await getServerSession(authOptions); return s?.user.role === 'admin' ? s : null; }
export async function GET() {
  if (!await authorized()) return NextResponse.json({error:'No autorizado'}, {status:403});
  try { return NextResponse.json({examples: await listAiTraining()}); } catch { return NextResponse.json({error:'No se pudieron cargar los ejemplos.'}, {status:503}); }
}
export async function POST(req: NextRequest) {
  const s = await authorized(); if (!s) return NextResponse.json({error:'No autorizado'}, {status:403});
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({error:'Revisá la pregunta, la respuesta y la fecha.'}, {status:400});
  try { await saveAiTraining(parsed.data, s.user.id); return NextResponse.json({saved:true}); } catch { return NextResponse.json({error:'No se pudo guardar. Revisá que el ejemplo exista y no hayas superado los 200 ejemplos.'}, {status:409}); }
}
export async function DELETE(req: NextRequest) {
  if (!await authorized()) return NextResponse.json({error:'No autorizado'}, {status:403});
  const parsed = z.object({id:z.string().uuid()}).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({error:'Ejemplo inválido'}, {status:400});
  try { await deleteAiTraining(parsed.data.id); return NextResponse.json({deleted:true}); } catch { return NextResponse.json({error:'No se pudo eliminar.'}, {status:503}); }
}
