import type { MiaVerifiedQuote } from '@/lib/whatsapp-mia-sources';

export const MIA_CONCISE_SALES_POLICY = `Sos MIA, asistente comercial de Barrera Brokers: desarrollos en construcción y a estrenar en Buenos Aires. Tono argentino cálido y profesional. Máximo tres líneas breves y una sola pregunta por respuesta. Respondé primero lo consultado y proponé un próximo paso útil, sin insistir ante un rechazo. No preguntes nombre, teléfono, objetivo, barrio ni presupuesto ya conocidos. Recomendá una sola unidad compatible, nunca una lista. El catálogo comercial autorizado es independiente del feed publicitario de Meta: no lo limites a ocho desarrollos. Los ejemplos de conversaciones no son datos comerciales. Nunca presentes Moca 2 como ubicado en Núñez. No juntes precio total, anticipo, cuotas y advertencias en una respuesta. Reservá la aclaración de disponibilidad y condiciones para avanzar con la reserva. No afirmes haber agendado, reservado, prerreservado, enviado un enlace o avisado al equipo: esas acciones requieren un resultado real del CRM. No prometas anticipos reembolsables ni solicites DNI por este chat. No inventes enlaces de reserva. Los horarios concretos los ofrece exclusivamente la agenda verificada. Ante una queja, reconocé la demora una vez y proponé un paso, sin prometer una llamada que no quedó coordinada.`;

/** Preserve commercial terms and links; reject rather than silently truncate them. */
export function validateMiaSalesReply(text: string): string {
  const reply = text.split('\n').map(line => line.trim()).filter(Boolean).join('\n');
  const prose = reply.replace(/https?:\/\/\S+/g, '');
  if (reply.split('\n').length > 3 || (prose.match(/\?/g) || []).length > 1 || reply.length > 850)
    throw Error('MIA reply exceeds three brief lines or one question');
  if (/\b(?:te (?:la |lo )?(?:dej[eé]|dejo|tengo)|ya (?:est[aá]|qued[oó]))[^.!?\n]{0,45}(?:pre.?reservad|agendad|reservad|disponible para visitar)|\b(?:reserva|prerreserva) (?:confirmada|registrada)|\b(?:ya (?:avis[eé]|envi[eé]|agend[eé])|anticipo reembolsable)\b/i.test(prose))
    throw Error('MIA claimed an action without a tool result');
  return reply;
}

export function renderMiaSalesQuote(q: MiaVerifiedQuote, mode: 'offer' | 'financing' = 'offer') {
  const amount = (n: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n);
  const heading = `${q.project} · Unidad ${q.unit}`;
  if (mode === 'financing') {
    if (!q.down || !q.months || !q.installment) return `${heading}: necesito confirmar el plan de financiación.\n¿Preferís revisar otra unidad o coordinar una reunión?`;
    return `${heading}\nAnticipo ${q.currency} ${amount(q.down)} + ${q.months} cuotas de referencia de ${q.currency} ${amount(q.installment)}. ${q.adjustment || 'Ajustes pendientes de confirmar.'}\n¿Ese plan se ajusta a tu presupuesto?`;
  }
  return `${heading}\n${q.area ? q.area + ' · ' : ''}Precio de lista: ${q.currency} ${amount(q.price)}${q.originalBudget && q.price > q.originalBudget ? ' (supera tu presupuesto original)' : ''}.\n¿Preferís revisar la financiación o coordinar una reunión?`;
}
