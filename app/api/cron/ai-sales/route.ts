import { NextResponse } from 'next/server';
import { processSales } from '@/lib/ai-sales/worker';
export const dynamic='force-dynamic';
export const maxDuration=300;
export async function GET(request:Request){
 if(!process.env.CRON_SECRET||request.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:'No autorizado'},{status:401});
 try{return NextResponse.json(await processSales());}catch{return NextResponse.json({error:'AI Sales no está disponible. Revisar migración y configuración.'},{status:503});}
}
