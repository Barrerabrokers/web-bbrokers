import { explicitlyConfirmsMeeting, meetingIntent } from '@/lib/mia-meeting-policy';

export function asksMeetingStatus(text: string) {
  return /(?:reuni[oó]n|cita).{0,35}confirmad|confirmad[ao].{0,35}(?:reuni[oó]n|cita)|(?:^|[¿?])\s*(?:ya\s+)?(?:est[aá]|qued[oó]|sigue)\s+confirmad[ao][?.!\s]*$/i.test(text.trim());
}

export function routesToMiaMeeting(inbound: string, previousReply: string) {
  if (meetingIntent(inbound) || asksMeetingStatus(inbound)) return true;
  if (!/agend|coordin|cambiar|reprogram|reuni[oó]n|horario|google meet|cambio todav[ií]a no est[aá] confirmado|evento original en Calendar/i.test(previousReply)) return false;
  return explicitlyConfirmsMeeting(inbound)
    || /^(?:la\s+)?(?:primera|segunda|[12])\s*[.!]?$/i.test(inbound.trim())
    || /\b(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|ma[nñ]ana|hoy)\b|\b\d{1,2}:\d{2}(?=hs?\b|\b)|@|\b(?:cancel|reprogram|cambiarla)/i.test(inbound);
}
