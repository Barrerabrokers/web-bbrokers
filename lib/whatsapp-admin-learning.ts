import { ensureCorrectionSchema } from '@/lib/whatsapp-ai-correction';
import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
import { firstContactWhatsAppPhoneId } from '@/lib/whatsapp-inbox-scope';
import type { AiTrainingExample } from '@/lib/crm-ai-training-prompt';
/** Examples are retrieved from the saved administrator messages, never AI output or imported history. */
export function redactAdministratorExample(text:string,contactName='') {
  let result=text.replace(/\[Origen del anuncio\][\s\S]*$/,'')
    .replace(/^\s*(?:Email|Full name|Phone number|Nombre|Correo electr[oó]nico|Tel[eé]fono)\s*:.*$/gim,'')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[correo omitido]')
    .replace(/https?:\/\/\S+/gi,'[enlace omitido]')
    .replace(/\+\s*\d[\d\s().-]{8,}\d/g,'[teléfono omitido]');
  if(contactName.length>1){const escaped=contactName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');result=result.replace(new RegExp(escaped,'gi'),'[cliente]');const first=contactName.trim().split(/\s+/)[0];if(first.length>2)result=result.replace(new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'gi'),'[cliente]');}
  return result.trim();
}
export async function listAdministratorLearning(query:string):Promise<AiTrainingExample[]> {
  await ensureCorrectionSchema();
  const sql=getSharedDatabase();
  try {
    const rows=await sql`SELECT m.id,m.content AS answer,c.contact_name,q.content AS question,
      ts_rank_cd(to_tsvector('spanish',m.content||' '||q.content),plainto_tsquery('spanish',${query.slice(0,1500)})) AS relevance
      FROM crm_whatsapp_messages m JOIN crm_whatsapp_conversations c ON c.id=m.conversation_id
      JOIN agents a ON a.id=m.sender_agent_id
      JOIN LATERAL (SELECT content FROM crm_whatsapp_messages incoming
        WHERE incoming.conversation_id=m.conversation_id AND incoming.direction='inbound'
          AND incoming.sender_type='customer' AND incoming.status<>'historical'
          AND (incoming.created_at,incoming.id)<(m.created_at,m.id)
        ORDER BY incoming.created_at DESC,incoming.id DESC LIMIT 1) q ON TRUE
      WHERE c.channel='whatsapp' AND c.business_phone_number_id=${firstContactWhatsAppPhoneId()}
        AND m.direction='outbound' AND m.sender_type='agent' AND a.role='admin'
        AND m.status IN ('sent','delivered','read') AND length(m.content)>=15
        AND NOT EXISTS (SELECT 1 FROM crm_whatsapp_ai_corrections correction WHERE correction.conversation_id=m.conversation_id AND correction.answer=m.content)
        AND m.content !~ '^\\[(Imagen|PDF) adjunto:'
      ORDER BY relevance DESC,m.created_at DESC LIMIT 60`;
    return rows.filter(r=>!/(?:herencia|falleci[oó]|muri[oó]|c[aá]ncer|duelo|\bdni\b|\bcuit\b|\bcbu\b|mi domicilio)/i.test(r.question+' '+r.answer)).map(r=>({
      id:r.id,question:redactAdministratorExample(r.question,r.contact_name).slice(0,240),
      answer:redactAdministratorExample(r.answer,r.contact_name).slice(0,420),
      context:'Ejemplo de asesoramiento de administrador. Precios y condiciones: consultar las listas actuales.',
      enabled:true,expiresAt:null,source:'administrator' as const,
    })).filter(e=>e.question&&e.answer.length>=15);
  }finally{await releaseSharedDatabase(sql);}
}
