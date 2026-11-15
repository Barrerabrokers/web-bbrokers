import type postgres from "postgres";
import { createCrmActivity, getCrmEmailAccountWithSecret } from "@/lib/db";
import { getAccessTokenForGoogleAccount } from "@/lib/google-oauth";
import { replySenderAddress, findBody, header, type GmailMessage } from "@/lib/crm-email-replies";

// Poll each mailbox once, rather than rotating through thousands of leads.
// Only mail from a CRM customer assigned to or contacted by this agent is stored.
export async function syncRecentCrmReplies(sql: ReturnType<typeof postgres>, origin: string) {
  let imported=0,failed=0;
  const accounts=await sql`SELECT a.agent_id,c.checked_at FROM crm_email_accounts a
    JOIN agents agent ON agent.id=a.agent_id LEFT JOIN crm_email_inbox_checks c ON c.agent_id=a.agent_id
    WHERE agent.active=TRUE AND agent.role IN('admin','agent','marketing')
      AND a.provider='google-oauth' AND a.google_scopes LIKE '%gmail.readonly%'
    ORDER BY c.checked_at ASC NULLS FIRST`;
  const deadline=Date.now()+90000;
  for(const row of accounts) {
    if(Date.now()>deadline)break;
    try {
      const agentId=String(row.agent_id);
      await sql`INSERT INTO crm_email_inbox_checks(agent_id) VALUES(${agentId}) ON CONFLICT DO NOTHING`;
      const [state]=await sql`SELECT checked_at FROM crm_email_inbox_checks WHERE agent_id=${agentId}`;
      const started=new Date();
      const since=Math.floor((new Date(state.checked_at).getTime()-60000)/1000);
      const until=Math.floor(started.getTime()/1000);
      const account=await getCrmEmailAccountWithSecret(agentId);
      if(!account)throw new Error("Falta la cuenta de correo.");
      const token=await getAccessTokenForGoogleAccount({origin,account});
      const read=async(path:string)=>{
        const response=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`,{
          headers:{Authorization:`Bearer ${token}`},cache:"no-store",signal:AbortSignal.timeout(10000),
        });
        const data=await response.json().catch(()=>null);
        if(!response.ok)throw new Error("No se pudo consultar Gmail.");
        return data;
      };
      let pageToken="",complete=true;
      do {
        const query=new URLSearchParams({q:`after:${since} before:${until} -in:sent`,maxResults:"50"});
        if(pageToken)query.set("pageToken",pageToken);
        const page=await read(`messages?${query}`);
        for(const item of page.messages || []) {
          if(Date.now()>deadline){complete=false;break;}
          const externalId=`gmail:${agentId}:${item.id}`;
          const existing=await sql`SELECT id FROM crm_activities WHERE external_source='gmail_inbound'
            AND created_by=${agentId} AND external_id IN (${item.id},${externalId}) LIMIT 1`;
          if(existing.length)continue;
          const message: GmailMessage=await read(`messages/${encodeURIComponent(item.id)}?format=full`);
          if(!message?.id)throw new Error("Gmail no confirmó el mensaje.");
          const sender=replySenderAddress(header(message,"From"));
          const automated=header(message,"Auto-Submitted").toLowerCase();
          if(!sender || sender===account.email.toLowerCase() || (automated && automated!=="no"))continue;
          const leads=await sql`SELECT l.id FROM crm_leads l WHERE lower(trim(l.email))=${sender}
            AND (l.assigned_agent_id=${agentId} OR EXISTS(SELECT 1 FROM crm_email_trackings t WHERE t.lead_id=l.id AND t.agent_id=${agentId}))
            ORDER BY (l.assigned_agent_id=${agentId}) DESC,l.updated_at DESC LIMIT 1`;
          if(!leads.length)continue;
          const received=message.internalDate ? new Date(Number(message.internalDate)) : started;
          if(!Number.isFinite(received.getTime()) || received.getTime()<since*1000 || received.getTime()>=until*1000)continue;
          const result=await createCrmActivity({leadId:String(leads[0].id),type:"correo",
            title:`Respuesta por correo: ${header(message,"Subject") || "Sin asunto"}`,
            body:findBody(message.payload).trim() || "El cliente respondió el correo. Abrí Gmail para consultar el contenido completo.",
            scheduledAt:received.toISOString(),createdBy:agentId,externalSource:"gmail_inbound",externalId});
          if(result.error)throw new Error("No se pudo guardar la respuesta en el CRM.");
          if(result.activity)imported++;
        }
        pageToken=page.nextPageToken || "";
        if(Date.now()>deadline)complete=false;
      } while(pageToken && complete);
      // Never advance over an incomplete page or a failed message.
      if(complete)await sql`UPDATE crm_email_inbox_checks SET checked_at=${started} WHERE agent_id=${agentId}`;
    }catch{failed++;console.error("No se pudieron sincronizar respuestas de la cuenta CRM",row.agent_id);}
  }
  return {imported,failed};
}
