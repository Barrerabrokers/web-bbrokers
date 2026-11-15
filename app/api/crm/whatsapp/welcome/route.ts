import { getMiaResetConfig } from '@/lib/mia-reset-runtime';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DEFAULT_WHATSAPP_WELCOME } from '@/lib/whatsapp-welcome-only';
export const dynamic = 'force-dynamic';
export async function GET() {
  if ((await getServerSession(authOptions))?.user.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const config=await getMiaResetConfig();
  return NextResponse.json({ mode: config.audience==='all'?'conversational':'welcome-only',activatedAt:config.activatedAt, welcome: DEFAULT_WHATSAPP_WELCOME, sources: { projectsUrl: '' } }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function PUT() {
  return NextResponse.json({ error: 'El modo de MIA se administra desde su configuración de activación.' }, { status: 410 });
}
