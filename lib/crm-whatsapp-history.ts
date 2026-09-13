// WhatsApp Web in Spanish exposes local time in data-pre-plain-text.
export function whatsAppMessageDate(value: string): string | null {
  const match = value.match(/\[(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?\s*m\.?)?,\s*(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\]/i);
  if (!match) return null;
  let hour=Number(match[1]);const minute=Number(match[2]),day=Number(match[4]),month=Number(match[5]);let year=Number(match[6]);if(year<100)year+=2000;
  if(match[3]){if(hour<1||hour>12)return null;hour=hour%12+(match[3].toLowerCase().startsWith('p')?12:0);}
  if(hour>23||minute>59||month<1||month>12||day<1||day>31)return null;
  const date=new Date(Date.UTC(year,month-1,day,hour+3,minute));
  const local=new Date(date.getTime()-3*3600000);
  if(local.getUTCDate()!==day||local.getUTCMonth()!==month-1)return null;
  return date.toISOString();
}
export function isInboundWhatsApp(title:string,source?:string) {
  return source==='whatsapp_inbound'||/^(respuesta por whatsapp|whatsapp recibido)/i.test(title);
}
