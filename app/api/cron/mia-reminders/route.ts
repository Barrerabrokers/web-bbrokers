import { NextResponse } from 'next/server';
import { processMiaReminders } from '@/mia/lib/reminders';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({error: 'No autorizado'}, {status: 401});
  }
  try {
    return NextResponse.json(await processMiaReminders());
  } catch {
    console.error('mia-reminders-worker-failed');
    return NextResponse.json({error: 'No se pudieron procesar los recordatorios'}, {status: 503});
  }
}
