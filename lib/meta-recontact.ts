import { getSharedDatabase, releaseSharedDatabase } from "@/lib/database-pool";
import { randomUUID } from "crypto";
import type postgres from "postgres";

// Only submissions received after this feature was enabled reopen contacts.
export const META_RECONTACT_ENABLED_AT = "2026-10-02T16:23:44.000Z";
export function isNewMetaRecontact(createdAt?: string) {
  return Boolean(createdAt && Date.parse(createdAt) >= Date.parse(META_RECONTACT_ENABLED_AT));
}

export async function reopenMetaContact(input: {leadId:string;campaignLeadId:string;campaignName?:string;formName?:string}, existingSql?: ReturnType<typeof postgres>) {
  const sql=existingSql || getSharedDatabase();
  try {
    return await sql.begin(async tx=>{
      const [lead]=await tx`SELECT first_name,last_name,assigned_agent_id FROM crm_leads WHERE id=${input.leadId} FOR UPDATE`;
      if(!lead)throw new Error("No se encontró el contacto de Meta.");
      const completed=await tx`SELECT id FROM crm_activities WHERE external_source='meta_lead_ads' AND external_id=${input.campaignLeadId} LIMIT 1`;
      if(completed.length)return {reopened:false,notified:false};
      // The event and status update commit together. A webhook/recovery retry
      // must not reopen a lead again after the agent has already contacted it.
      const events=await tx`INSERT INTO crm_meta_recontacts(meta_lead_id,lead_id) VALUES(${input.campaignLeadId},${input.leadId})
        ON CONFLICT(meta_lead_id) DO NOTHING RETURNING meta_lead_id`;
      if(!events.length)return {reopened:false,notified:false};
      await tx`SELECT set_config('crm.meta_recontact_event',${input.campaignLeadId},true)`;
      await tx`UPDATE crm_leads SET status='Nuevo',updated_at=NOW() WHERE id=${input.leadId}`;
      if(!lead.assigned_agent_id)return {reopened:true,notified:false};
      const name=`${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "El cliente";
      const context=[input.campaignName?.trim()?`Campaña: ${input.campaignName.trim()}`:"",input.formName?.trim()?`Formulario: ${input.formName.trim()}`:""].filter(Boolean).join(" · ");
      const notifications=await tx`INSERT INTO crm_notifications(id,recipient_agent_id,lead_id,event_key,type,title,body,href)
        VALUES(${randomUUID()},${lead.assigned_agent_id},${input.leadId},${`campaign-recontact:${input.campaignLeadId}`},'campaign_recontact',
        ${`${name} volvió a consultar desde Meta`},${`El contacto pasó a Nuevo. Comunicate con el cliente para atender su nueva consulta.${context?` ${context}`:""}`},${`/admin/crm/${input.leadId}?activity=all`})
        ON CONFLICT(event_key) DO NOTHING RETURNING id`;
      return {reopened:true,notified:notifications.length>0};
    });
  } finally {if(!existingSql)await releaseSharedDatabase(sql);}
}
