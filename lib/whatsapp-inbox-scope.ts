// Phone number ID observed on messages delivered to the commercial WhatsApp line.
export const FIRST_CONTACT_WHATSAPP_NUMBER = '+54 11 6406-9668';
export function firstContactWhatsAppPhoneId() {
 return process.env.WHATSAPP_INBOX_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || '994285683758148';
}
