/** Internal boundary inserted by the verified quote renderer; never sent or saved. */
export const MIA_MESSAGE_BOUNDARY = '\f';
export function splitMiaReplyMessages(reply: string): string[] {
  return reply.split(MIA_MESSAGE_BOUNDARY).map(part => part.trim()).filter(Boolean);
}
