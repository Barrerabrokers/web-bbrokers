import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { miaWeeklyLearningReport } from '@/lib/mia-learnings';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 const session=await getServerSession(authOptions);
 if(session?.user.role!=='admin')return NextResponse.json({error:'Solo administradores.'},{status:403});
 try{return NextResponse.json(await miaWeeklyLearningReport(),{headers:{'Cache-Control':'no-store'}});}
 catch{return NextResponse.json({error:'No se pudo cargar el resumen de aprendizaje.'},{status:503});}
}
