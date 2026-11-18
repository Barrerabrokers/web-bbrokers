/** Minimum quiet period after the most recently received customer message. */
export const WHATSAPP_REPLY_DELAY_MS = 1_000;
export function whatsAppReplyDelayRemaining(receivedAt: string | number, now = Date.now()) {
  const received = typeof receivedAt === 'number' ? receivedAt : Date.parse(receivedAt);
  if (!Number.isFinite(received)) throw new Error('Missing WhatsApp receive timestamp');
  return Math.max(0, received + WHATSAPP_REPLY_DELAY_MS - now);
}
export async function waitForWhatsAppReplyDelay(receivedAt: string | number) {
  let remaining: number;
  while ((remaining = whatsAppReplyDelayRemaining(receivedAt)) > 0) {
    await new Promise(resolve => setTimeout(resolve, remaining));
  }
}
