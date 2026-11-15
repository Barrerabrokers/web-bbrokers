import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCrmLeadById } from '@/lib/db';
import { canManageListings, canViewAllCrmContacts } from '@/lib/roles';
import { MAX_CRM_AUDIO_BYTES, validateCrmAudio } from '@/lib/crm-audio';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (Number(request.headers.get('content-length')) > MAX_CRM_AUDIO_BYTES + 50_000) return NextResponse.json({ error: 'El audio supera los 4 MB.' }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const leadId = form?.get('leadId');
  if (!z.string().uuid().safeParse(leadId).success) return NextResponse.json({ error: 'Contacto requerido.' }, { status: 400 });
  const lead = await getCrmLeadById(leadId as string, { agentId: session.user.id, includeAll: canViewAllCrmContacts(session.user.role) });
  if (!lead) return NextResponse.json({ error: 'No podés modificar este contacto.' }, { status: 403 });
  const file = form?.get('audio');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Elegí o grabá un audio.' }, { status: 400 });
  const error = validateCrmAudio(file);
  if (error) return NextResponse.json({ error }, { status: file.size > MAX_CRM_AUDIO_BYTES ? 413 : 400 });
  const key = process.env.GROQ_API_KEY;
  if (!key) return NextResponse.json({ error: 'La transcripción no está configurada. Contactá al administrador.' }, { status: 503 });
  const payload = new FormData();
  payload.set('file', file);
  payload.set('model', 'whisper-large-v3');
  payload.set('response_format', 'json');
  payload.set('temperature', '0');
  try {
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: payload, signal: AbortSignal.timeout(45_000) });
    if (!response.ok) return NextResponse.json({ error: response.status === 429 ? 'La transcripción está ocupada. Reintentá en unos instantes.' : 'No se pudo transcribir el audio. Reintentá o probá otro archivo.' }, { status: response.status === 429 ? 429 : 502 });
    const data = await response.json() as { text?: unknown };
    const text = typeof data.text === 'string' ? data.text.trim() : '';
    if (!text) return NextResponse.json({ error: 'No se detectó voz en el audio. Grabá nuevamente.' }, { status: 422 });
    return NextResponse.json({ text }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'No se pudo completar la transcripción. Tu texto se conserva; podés reintentar.' }, { status: 504 });
  }
}
