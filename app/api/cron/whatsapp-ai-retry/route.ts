import { NextResponse } from 'next/server';
import { processWhatsAppReactivation } from '@/lib/whatsapp-reactivation';
import { processWhatsAppAiRetries } from '@/lib/whatsapp-ai-retry';
export const dynamic='force-dynamic';
export const maxDuration=300;
export async function GET(request:Request) {
 if (!process.env.CRON_SECRET || request.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({error:'No autorizado'},{status:401});
 try {const reactivation=await processWhatsAppReactivation();return NextResponse.json({retry:await processWhatsAppAiRetries(),reactivation});}catch{return NextResponse.json({error:'No se pudieron recuperar las respuestas pendientes.'},{status:503});}
}
