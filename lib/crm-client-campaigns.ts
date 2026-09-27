import type { CrmEmailTemplateContentBlock } from "@/lib/db";
import { clientDb, ensureClients, getClientEmailTemplate } from "@/lib/crm-clients";
import { sendPrivateClientEmail } from "@/lib/crm-email-sender";

function resolve(value:string,name:string,agentName:string,agentPhone:string) {
  const [firstName,...lastParts]=name.trim().split(/\s+/);
  return String(value||"").replaceAll("{{cliente_nombre}}",firstName||name).replaceAll("{{cliente_apellido}}",lastParts.join(" "))
    .replaceAll("{{cliente_nombre_completo}}",name).replaceAll("{{propietario_contacto}}",agentName).replaceAll("{{telefono_agente}}",agentPhone);
}

export function resolveCampaignBlocks(blocks:CrmEmailTemplateContentBlock[],name:string,agentName:string,agentPhone:string):CrmEmailTemplateContentBlock[] {
  return blocks.map(block=>block.type==="text"?{...block,text:resolve(block.text,name,agentName,agentPhone),html:block.html?resolve(block.html,name,agentName,agentPhone):block.html}
    :block.type==="button"?{...block,label:resolve(block.label,name,agentName,agentPhone),url:resolve(block.url,name,agentName,agentPhone)}
    :block.type==="attachment"?{...block,name:resolve(block.name,name,agentName,agentPhone),url:resolve(block.url,name,agentName,agentPhone)}
    :block.type==="image"?{...block,alt:resolve(block.alt||"",name,agentName,agentPhone),caption:resolve(block.caption||"",name,agentName,agentPhone),linkUrl:resolve(block.linkUrl||"",name,agentName,agentPhone)}
    :block.type==="columns"?{...block,columns:block.columns.map(column=>column.type==="text"?{...column,text:resolve(column.text,name,agentName,agentPhone),html:column.html?resolve(column.html,name,agentName,agentPhone):column.html}:column)}:block);
}

export function resolveCampaignText(value:string,name:string,agentName:string,agentPhone:string) {
  return resolve(value,name,agentName,agentPhone);
}

export async function resumeClientCampaign(campaignId:string,limit=15) {
  const sql=clientDb();
  let sent=0,failed=0,failure="",locked=false;
  try {
    await ensureClients(sql);
    const [lock]=await sql`SELECT pg_try_advisory_lock(735208446) AS acquired`;
    locked=Boolean(lock?.acquired);
    if(!locked)return {sent,failed,remaining:0,busy:true};
    await sql`UPDATE crm_client_mail_history SET status='uncertain',last_error='Intento interrumpido; reprogramado automáticamente.'
      WHERE status='sending' AND COALESCE(last_attempt_at,created_at)<NOW()-INTERVAL '15 minutes'`;
    const [campaign]=await sql`SELECT agent_id,template_id FROM crm_client_mail_history WHERE campaign_id=${campaignId} ORDER BY created_at LIMIT 1`;
    if(!campaign)return {sent,failed,remaining:0,error:"No encontramos la campaña."};
    const template=campaign.template_id?await getClientEmailTemplate(String(campaign.template_id)):null;
    if(!template)return {sent,failed,remaining:0,error:"La plantilla original ya no está disponible."};
    const [sender]=await sql`SELECT name,phone,email FROM agents WHERE id=${campaign.agent_id}`;
    const recipients=await sql`SELECT h.id,h.recipient,h.tracking_token,h.reply_to_email,c.name,
      COALESCE(a.name,${String(sender?.name||"Barrera Brokers")}) AS owner_name,COALESCE(a.phone,${String(sender?.phone||"")}) AS owner_phone
      FROM crm_client_mail_history h JOIN crm_private_clients c ON c.id=h.client_id LEFT JOIN agents a ON a.id=h.owner_agent_id
      WHERE h.campaign_id=${campaignId} AND h.status='uncertain' AND COALESCE(h.retry_count,0)<5
        AND (h.last_attempt_at IS NULL OR h.last_attempt_at<NOW()-INTERVAL '5 minutes')
      ORDER BY h.created_at,h.id LIMIT ${Math.min(25,Math.max(1,limit))}`;
    const origin=(process.env.NEXT_PUBLIC_SITE_URL||process.env.NEXTAUTH_URL||"https://barrerabrokers.com").replace(/\/$/,"");
    for(const recipient of recipients) {
      const [claimed]=await sql`UPDATE crm_client_mail_history SET status='sending',retry_count=COALESCE(retry_count,0)+1,last_attempt_at=NOW(),last_error=''
        WHERE id=${recipient.id} AND status='uncertain' RETURNING id`;
      if(!claimed)continue;
      const name=String(recipient.name||"Cliente"),agentName=String(recipient.owner_name),agentPhone=String(recipient.owner_phone);
      const subject=resolve(template.subject,name,agentName,agentPhone),body=resolve(template.body,name,agentName,agentPhone);
      try {
        await sendPrivateClientEmail({agentId:String(campaign.agent_id),email:String(recipient.recipient),subject,body,imageUrls:template.imageUrls,
          contentBlocks:resolveCampaignBlocks(template.contentBlocks,name,agentName,agentPhone),replyTo:String(recipient.reply_to_email||sender?.email||""),
          openTrackingUrl:`${origin}/api/crm/clients/open/${recipient.tracking_token}.png`,clickTrackingBaseUrl:`${origin}/api/crm/clients/click/${recipient.tracking_token}`});
        await sql`UPDATE crm_client_mail_history SET subject=${subject},body=${body},status='sent',sent_at=NOW(),last_error='' WHERE id=${recipient.id}`;
        sent++;
        await new Promise(resolveDelay=>setTimeout(resolveDelay,650));
      } catch(error) {
        failure=(error instanceof Error?error.message:"No se pudo enviar el correo.").slice(0,500);
        await sql`UPDATE crm_client_mail_history SET status='uncertain',last_error=${failure} WHERE id=${recipient.id}`;
        failed++;
        console.error("CRM campaign resume stopped:",failure);
        break;
      }
    }
    const [{count}]=await sql`SELECT COUNT(*)::int AS count FROM crm_client_mail_history WHERE campaign_id=${campaignId} AND status='uncertain'`;
    return {sent,failed,remaining:Number(count||0),...(failure?{error:failure}:{})};
  } finally {
    if(locked)await sql`SELECT pg_advisory_unlock(735208446)`;
    await sql.end();
  }
}

export async function processPendingClientCampaigns(limit=12) {
  const sql=clientDb();
  try {
    await ensureClients(sql);
    const [row]=await sql`SELECT campaign_id FROM crm_client_mail_history
      WHERE campaign_id IS NOT NULL AND status='uncertain' AND COALESCE(retry_count,0)<5
        AND (last_attempt_at IS NULL OR last_attempt_at<NOW()-INTERVAL '5 minutes')
      GROUP BY campaign_id ORDER BY MIN(created_at),campaign_id LIMIT 1`;
    if(!row?.campaign_id)return {sent:0,failed:0,remaining:0,idle:true};
    return {...await resumeClientCampaign(String(row.campaign_id),limit),campaignId:String(row.campaign_id),idle:false};
  } finally {await sql.end();}
}
