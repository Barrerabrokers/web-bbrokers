import { extractWhatsAppForm } from '@/lib/whatsapp-form-context';
export const DEFAULT_WHATSAPP_WELCOME = `Hola, {{nombre}}, ¿cómo estás? ¡Qué bueno que te contactaste por nuestros desarrollos! En breve, un agente se va a estar contactando para ofrecerte opciones de unidades. Saludos.`;
type Message = { direction: string; content: string; status?: string; createdAt?: string };
export function needsWhatsAppWelcome(messages: Message[]) {
  const history = messages.filter(message => message.status !== 'cleared');
  if (!history.length || history.some(message => message.direction !== 'inbound' || message.status === 'historical')) return false;
  const first = history[0];
  if (first.createdAt && Date.parse(first.createdAt) < Date.now() - 23 * 60 * 60 * 1000) return false;
  return !history.some(message => /(?:no me contact|no me escrib|no quiero recibir|darme de baja)/i.test(message.content));
}
export function renderWhatsAppWelcome(template: string, messages: Message[], crm: Record<string, unknown> = {}) {
  const formName = messages.map(message => extractWhatsAppForm(message.content).name).find(Boolean);
  const firstName = String(formName || crm.nombre || '').trim().split(/\s+/)[0];
  const name = /^[\p{L}\p{M}'’-]{1,40}$/u.test(firstName) ? firstName : '';
  return template.replaceAll('{{nombre}}', name).replace(/Hola,\s*!/gi, 'Hola!').replace(/Hola,\s*,/gi, 'Hola,').trim();
}
export function validateWhatsAppWelcome(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 4000) throw new Error('Escribí un mensaje de entre 1 y 4000 caracteres.');
  if ((value.match(/{{[^}]*}}/g) || []).some(variable => variable !== '{{nombre}}')) throw new Error('La variable disponible es {{nombre}}.');
  return value.trim();
}
