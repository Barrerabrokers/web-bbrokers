import { explicitlyConfirmsMeeting, meetingIntent } from '@/lib/mia-meeting-policy';

export function routesToMiaMeeting(inbound: string, previousReply: string) {
  if (meetingIntent(inbound)) return true;
  if (!/agend|coordin|reuni[oó]n|horario|google meet/i.test(previousReply)) return false;
  return explicitlyConfirmsMeeting(inbound)
    || /^(?:la\s+)?(?:primera|segunda|[12])\s*[.!]?$/i.test(inbound.trim())
    || /\b(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|ma[nñ]ana|hoy)\b|\b\d{1,2}:\d{2}\b|@|\b(?:cancel|reprogram|cambiarla)/i.test(inbound);
}
