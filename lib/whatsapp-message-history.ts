import type { WhatsAppMessage } from '@/lib/whatsapp-inbox';
/** A deletion marker also invalidates previously loaded pages and stale polling responses. */
export function mergeWhatsAppMessageHistory(current:WhatsAppMessage[],incoming:WhatsAppMessage[]) {
  const messages=[...new Map([...current,...incoming].map(m=>[m.id,m])).values()].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)||a.id.localeCompare(b.id));
  const marker=messages.filter(m=>m.status==='cleared').at(-1);
  return marker?messages.filter(m=>m.id===marker.id||Date.parse(m.createdAt)>Date.parse(marker.createdAt)):messages;
}
