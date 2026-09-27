import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { canManageListings,canViewAllCrmContacts } from '@/lib/roles';
import { aiDb,readSales,filtersSchema } from '@/lib/ai-sales/store';
import { scheduleSalesAnalysis } from '@/lib/ai-sales/schedule';
export const maxDuration=60;
export const dynamic='force-dynamic';
async function actor(){const s=await getServerSession(authOptions);return s&&canManageListings(s.user.role)?{id:s.user.id,all:canViewAllCrmContacts(s.user.role)}:null;}
export async function GET(request:Request){
 const user=await actor();if(!user)return NextResponse.json({error:'No autorizado'},{status:403});
 const id=new URL(request.url).searchParams.get('leadId')||undefined;
 if(id&&!z.string().uuid().safeParse(id).success)return NextResponse.json({error:'Contacto inválido'},{status:400});
 const filters=filtersSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
 if(!filters.success)return NextResponse.json({error:'Filtros inválidos'},{status:400});
 try{return NextResponse.json(await readSales(user,id,filters.data),{headers:{'Cache-Control':'private, no-store'}});}catch{return NextResponse.json({error:'No se pudo consultar AI Sales.'},{status:503});}
}
const input=z.object({leadId:z.string().uuid(),recommendationId:z.string().uuid().optional(),action:z.enum(['reanalyze','useful','not_useful','completed','dismissed','snoozed'])});
export async function POST(request:Request){
 const user=await actor();if(!user)return NextResponse.json({error:'No autorizado'},{status:403});
 const parsed=input.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Acción inválida'},{status:400});
 const sql=aiDb();
 try{
  const result=await sql.begin(async tx=>{
   const d=parsed.data;
   const [lead]=await tx`SELECT id FROM crm_leads WHERE id=${d.leadId} AND (${user.all} OR assigned_agent_id=${user.id}) FOR UPDATE`;
   if(!lead)return false;
   if(d.action==='reanalyze'){
    // Only one outstanding manual request, avoiding repeated model calls from clicks.
    await tx`INSERT INTO crm_ai_events(lead_id,event_type,source,source_id) SELECT ${lead.id},'lead_updated','manual',${user.id}
      WHERE NOT EXISTS(SELECT 1 FROM crm_ai_events WHERE lead_id=${lead.id} AND processed_at IS NULL AND source='manual')`;
    await tx`UPDATE crm_ai_state SET attempts=0,retry_at=NULL WHERE lead_id=${lead.id}`;
   }else{
    if(!d.recommendationId)return false;
    const [rec]=await tx`SELECT id FROM crm_ai_recommendations WHERE id=${d.recommendationId} AND lead_id=${lead.id} AND status IN ('pending','snoozed') FOR UPDATE`;
    if(!rec)return false;
    await tx`INSERT INTO crm_ai_feedback(recommendation_id,actor_id,action) VALUES(${rec.id},${user.id},${d.action})`;
    if(['completed','dismissed','snoozed'].includes(d.action))await tx`UPDATE crm_ai_recommendations SET status=${d.action},snoozed_until=CASE WHEN ${d.action}='snoozed' THEN now()+interval '1 day' ELSE NULL END,updated_at=now() WHERE id=${rec.id}`;
   }
   return true;
  });
  if(result&&parsed.data.action==='reanalyze')scheduleSalesAnalysis();
  return NextResponse.json(result?{ok:true}:{error:'Contacto o recomendación no disponible.'},{status:result?200:404});
 }catch{return NextResponse.json({error:'No se guardó la acción. Reintentá.'},{status:503});}finally{await sql.end();}
}
