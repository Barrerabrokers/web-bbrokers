import { after } from 'next/server';
import { miaSalesDb, notifyMiaSales } from './mia-sales-store';
import { enrollAssignedMiaContacts } from './mia-sales-assignment';
import { processMiaSalesPilot } from './mia-sales-worker';
/** Persist both openings before replying to the assignment request. after keeps the worker alive on Vercel. */
export async function dispatchMiaAssignment(ids:string[]){
 const leadIds=Array.from(new Set(ids)).filter(id=>/^[a-f0-9-]{36}$/i.test(id)).slice(0,500);
 if(!leadIds.length)return {queuedContacts:0};
 const sql=miaSalesDb();
 try{
  const [ready]=await sql`SELECT to_regclass('public.crm_mia_sales_control') IS NOT NULL ready`;if(!ready?.ready)return {queuedContacts:0};
  const queuedContacts=await enrollAssignedMiaContacts(sql,leadIds);
  const eligible=await sql`SELECT DISTINCT e.lead_id FROM crm_mia_sales_enrollments e JOIN crm_mia_sales_control c ON c.run_id=e.run_id JOIN crm_leads l ON l.id=e.lead_id JOIN crm_mia_sales_jobs j ON j.lead_id=e.lead_id AND j.run_id=e.run_id WHERE c.enabled AND c.automatic_assignments AND e.state='working' AND l.assigned_agent_id=c.agent_id AND e.lead_id=ANY(${leadIds}::uuid[]) AND j.kind='opening' AND j.state IN('pending','blocked') AND j.due_at<=NOW()`;
  if(eligible.length)after(async()=>{
   // Bounded batches: a timeout leaves durable pending jobs for cron recovery, never duplicate sends.
   const started=Date.now();
   for(let offset=0;offset<eligible.length&&Date.now()-started<220000;offset+=10){
    const batch=eligible.slice(offset,offset+10).map((e:any)=>e.lead_id);
    try{
     let result=await processMiaSalesPilot({leadIds:batch});
     for(let retry=0;result.busy&&retry<10&&Date.now()-started<220000;retry++){await new Promise(resolve=>setTimeout(resolve,2000));result=await processMiaSalesPilot({leadIds:batch});}
     if(result.busy){
      const retry=miaSalesDb();try{for(const id of batch)await notifyMiaSales(retry,id,'assignment-worker-busy:'+id,'MIA: contacto en cola','El seguimiento inmediato está en cola porque hay otro envío en proceso. Los trabajos quedan guardados para reintento.');}finally{await retry.end();}
      break;
     }
    }catch(error){console.error('mia-assignment-dispatch-failed',error instanceof Error?error.message:'worker error');}
   }
  });
  return {queuedContacts};
 }catch(error){console.error('mia-assignment-enqueue-failed',error instanceof Error?error.message:'database error');return {queuedContacts:0,warning:'La asignación se guardó; MIA debe recuperar el seguimiento desde la cola automática.'};}
 finally{await sql.end();}
}
