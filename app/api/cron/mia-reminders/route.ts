import { readMiaMeetingHealth } from '@/mia/lib/hotfix-monitoring';
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
    const reminders = await processMiaReminders();
    const health = await readMiaMeetingHealth().catch(() => {
      console.warn('mia-meeting-health-query-failed');
      return null;
    });
    if (health) console.info('mia-meeting-health', JSON.stringify(health));
    return NextResponse.json(reminders);
  } catch {
    console.error('mia-reminders-worker-failed');
    return NextResponse.json({error: 'No se pudieron procesar los recordatorios'}, {status: 503});
  }
}
