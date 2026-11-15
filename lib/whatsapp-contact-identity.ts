import crypto from 'crypto';
import { firstContactWhatsAppPhoneId } from '@/lib/whatsapp-inbox-scope';
/** Exact phone identity; Argentine international mobile 9 is a routing prefix. */
export function phoneIdentity(value:string) {
  const digits=value.replace(/\D/g,'');
  if(/^549\d{10}$/.test(digits))return '54'+digits.slice(3);
  return digits;
}
export function phoneIdentityVariants(value:string) {
  const key=phoneIdentity(value);
  if(/^54\d{10}$/.test(key)) {
    const national=key.slice(2);
    return {key,international:[key,'549'+national],national:[national,'9'+national,...(national.startsWith('11')?['1115'+national.slice(2),'01115'+national.slice(2)]:[])]};
  }
  return {key,international:[key],national:[] as string[]};
}
export async function ensureContactIdentitySchema(sql:any) {
  await sql`CREATE TABLE IF NOT EXISTS crm_whatsapp_phone_aliases (
    phone_key TEXT PRIMARY KEY, lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS crm_notifications (
    id UUID PRIMARY KEY,recipient_agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,event_key TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL DEFAULT '',href TEXT NOT NULL DEFAULT '',
    read_by UUID[] NOT NULL DEFAULT '{}',created_at TIMESTAMPTZ DEFAULT NOW(),expires_at TIMESTAMPTZ)`;
}
/** Inside the message transaction: only new real inbound messages on the company line. */
export async function notifyCompanyWhatsAppReply(sql:any,conversationId:string,messageId:string) {
  await sql`
    INSERT INTO crm_notifications(id,recipient_agent_id,lead_id,event_key,type,title,body,href)
    SELECT ${crypto.randomUUID()},COALESCE(l.assigned_agent_id,c.assigned_agent_id),l.id,
      ${'company-whatsapp:'+messageId},'campaign_recontact',
      CONCAT(TRIM(CONCAT(l.first_name,' ',NULLIF(l.last_name,'-'))),' sigue hablando por WhatsApp'),
      'Tu cliente volvió a escribir al WhatsApp de la empresa (+54) 11 6406-9668. Revisá la conversación para continuar la atención.',
      CONCAT('/admin/crm/',l.id::text,'?activity=all')
    FROM crm_whatsapp_conversations c JOIN crm_leads l ON l.id=c.lead_id
    WHERE c.id=${conversationId} AND c.channel='whatsapp'
      AND c.business_phone_number_id=${firstContactWhatsAppPhoneId()}
      AND COALESCE(l.assigned_agent_id,c.assigned_agent_id) IS NOT NULL
    ON CONFLICT(event_key) DO NOTHING`;
}

export async function findContactLead(sql:any,phone:string) {
  const identity=phoneIdentityVariants(phone);
  const rows=await sql`
        SELECT l.id,l.assigned_agent_id FROM crm_leads l
        WHERE l.id=(SELECT lead_id FROM crm_whatsapp_conversations WHERE phone=${phone} LIMIT 1)
          OR l.id=(SELECT lead_id FROM crm_whatsapp_phone_aliases WHERE phone_key=${identity.key})
          OR REGEXP_REPLACE(COALESCE(l.country_code,'')||COALESCE(l.phone,''),'\\D','','g')=ANY(${identity.international}::text[])
          OR REGEXP_REPLACE(COALESCE(l.phone,''),'\\D','','g')=ANY(${identity.international}::text[])
          OR (REGEXP_REPLACE(COALESCE(l.country_code,'54'),'\\D','','g')='54' AND REGEXP_REPLACE(COALESCE(l.phone,''),'\\D','','g')=ANY(${identity.national}::text[]))
        ORDER BY (l.id=(SELECT lead_id FROM crm_whatsapp_phone_aliases WHERE phone_key=${identity.key})) DESC NULLS LAST,
          (l.assigned_agent_id IS NOT NULL) DESC,l.created_at,l.id LIMIT 1`;
  return rows[0];
}
