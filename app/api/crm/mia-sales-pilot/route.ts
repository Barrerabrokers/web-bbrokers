import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { readMiaSalesPilot,startMiaSalesPilot,pauseMiaSalesPilot } from '@/lib/mia-sales-store';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){
 const session=await getServerSession(authOptions);if(session?.user.role!=='admin')return NextResponse.json({error:'Solo administradores.'},{status:403,headers});
 try{return NextResponse.json(await readMiaSalesPilot(),{headers});}catch{return NextResponse.json({error:'No se pudo consultar el piloto.'},{status:503,headers});}
}
export async function POST(request:NextRequest){
 const session=await getServerSession(authOptions);if(session?.user.role!=='admin')return NextResponse.json({error:'Solo administradores.'},{status:403,headers});
 const input=z.object({action:z.enum(['start','pause','resume']),leadIds:z.array(z.string().uuid()).min(1).max(5).optional()}).safeParse(await request.json().catch(()=>null));
 if(!input.success)return NextResponse.json({error:'Acción no válida.'},{status:400,headers});
 try{return NextResponse.json(input.data.action==='start'?await startMiaSalesPilot(session.user.id,input.data.leadIds||[]):await pauseMiaSalesPilot(session.user.id,input.data.action==='resume'),{headers});}
 catch(error){return NextResponse.json({error:error instanceof Error?error.message:'No se pudo actualizar el piloto.'},{status:409,headers});}
}
