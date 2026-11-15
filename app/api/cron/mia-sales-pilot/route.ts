import { processMiaMeetingRecovery } from '@/lib/mia-meeting-recovery';
import { NextResponse } from 'next/server';
import { processMiaSalesPilot } from '@/lib/mia-sales-worker';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=300;
export async function GET(request:Request){
 if(!process.env.CRON_SECRET||request.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:'No autorizado'},{status:401});
 try{const meetings=await processMiaMeetingRecovery().catch(()=>({pending:true}));return NextResponse.json({...await processMiaSalesPilot(),meetings});}catch(error){console.error('MIA sales worker',error instanceof Error?error.message:'Error de datos');return NextResponse.json({error:'No se pudo procesar el piloto.'},{status:503});}
}
