import { ensureWhatsAppContact, saveWhatsAppMessage } from '@/lib/whatsapp-inbox';
import { createCrmActivity } from '@/lib/db';
import { firstContactWhatsAppPhoneId } from '@/lib/whatsapp-inbox-scope';

// App echoes are outbound events. Never pass them to the customer/AI reply loop.
export function whatsAppAppEchoes(value: any, phoneId: string) {
  if (String(value.metadata?.phone_number_id || '') !== phoneId) return [];
  const messages = Array.isArray(value.message_echoes) ? value.message_echoes : [];
  return messages.flatMap((message: any) => {
    const phone = String(message.to || '').replace(/\D/g, '');
    const time = Number(message.timestamp) * 1000;
    if (!/^\d{8,15}$/.test(phone) || typeof message.id !== 'string' || !message.id || !Number.isFinite(time) || time < Date.UTC(2010,0,1) || time > Date.now()+300000) return [];
    const media = message[message.type] || {};
    const content = typeof message.text?.body === 'string' ? message.text.body : `[Mensaje ${String(message.type || 'sin texto').slice(0,30)}${typeof media.caption === 'string' ? `: ${media.caption}` : ''}]`;
    return [{ phone, messageId: message.id, content: content.slice(0,20000), createdAt: new Date(time).toISOString() }];
  });
}
export async function processWhatsAppAppEchoes(value: any) {
  const phoneId = firstContactWhatsAppPhoneId();
  for (const message of whatsAppAppEchoes(value, phoneId)) {
    const conversation = await ensureWhatsAppContact(message.phone, '', phoneId);
    if (!conversation) continue;
    const inserted = await saveWhatsAppMessage({conversationId:conversation.id,whatsappMessageId:message.messageId,direction:'outbound',senderType:'agent',content:message.content,createdAt:message.createdAt});
    if (inserted && conversation.leadId) await createCrmActivity({leadId:conversation.leadId,type:'whatsapp',title:'WhatsApp enviado desde el celular',body:message.content,scheduledAt:message.createdAt,externalSource:'whatsapp_app_outbound',externalId:message.messageId});
  }
}
