import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { getMiaGuidance, saveMiaGuidance } from '@/lib/mia-guidance';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== 'admin') return NextResponse.json({ error: 'Solo administradores.' }, { status: 403 });
  try { return NextResponse.json(await getMiaGuidance(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ error: 'No se pudieron cargar las instrucciones.' }, { status: 503 }); }
}
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== 'admin') return NextResponse.json({ error: 'Solo administradores.' }, { status: 403 });
  const parsed = z.discriminatedUnion('action', [
    z.object({ action: z.literal('instructions'), revision: z.number().int().min(0), instructions: z.string().trim().max(6000) }),
    z.object({ action: z.literal('correction'), revision: z.number().int().min(0), incorrect: z.string().trim().min(1).max(3000), corrected: z.string().trim().min(1).max(3000), instruction: z.string().trim().max(3000).default('') }),
  ]).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Revisá los campos. Cada respuesta admite hasta 3000 caracteres y las instrucciones generales hasta 6000.' }, { status: 400 });
  try { return NextResponse.json(await saveMiaGuidance(parsed.data, session.user.id)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo guardar.' }, { status: 409 }); }
}
