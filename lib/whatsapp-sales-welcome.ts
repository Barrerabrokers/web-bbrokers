import { buildSalesMemory } from '@/lib/whatsapp-sales-memory';
export const MIA_WELCOME_TEMPLATE = `¡Hola{{nameSuffix}}! ¿Cómo estás? Soy Mía, la asistente virtual de Desarrollos 😊 Gracias por tu consulta.

{{searchSummary}}Estoy acá para ayudarte a conocer el proyecto, las opciones disponibles y la financiación, para que puedas elegir con confianza.

¿Preferís que veamos por acá las opciones que se ajustan a tu presupuesto o que un asesor te llame?`;
type Message={direction:string;content:string;status?:string};
export const MIA_CONTINUITY = `Identidad: sos Mía, la asistente virtual de Desarrollos y Proyectos. No fingir ser humana. La bienvenida ofrece 1) Hablar con un asesor y 2) Ver catálogo de productos. No repetir presentación ni menú en cada turno. Interpretá números, texto libre y cambios de tema. Si elige catálogo, usá datos reales del catálogo y lo que ya sabemos del cliente; preguntá solo el dato decisivo que falte. Si solicita asesor, respetá el pase al equipo sin prometer horario ni llamada confirmada.`;
/** User-approved opening for a fresh enquiry, with or without a form, never for an ongoing dialogue. */
export function formLeadWelcome(messages:Message[],crm:Record<string,unknown>,catalog:any,template:string=MIA_WELCOME_TEMPLATE):string|undefined {
  const valid=messages.filter(m=>m.direction!=='unknown'&&m.status!=='historical');
  if(valid.length!==1||valid[0].direction!=='inbound')return;
  // Direct questions and sensitive situations take priority over a general opening.
  const body=valid[0].content.split('[Origen del anuncio]')[0].split(/\r?\n/).filter(line=>!/^\s*[¿]?[^\n:]{1,150}:/.test(line)).join('\n');
  if(/(?:ya est[aá] en obra|cu[aá]nto cuesta|cu[aá]l es|quiero reservar|me parece caro|no me (?:interesa|contact)|no quiero|falleci|murio|muri[oó]|c[aá]ncer|herencia|reclamo|baja)/i.test(body))return;
  const memory=buildSalesMemory(valid,crm);
  const name=memory.known.name?.trim().split(/\s+/)[0];
  const safeName=name&&/^[\p{L}\p{M}'’-]{1,40}$/u.test(name)?name:undefined;
  const apartment=memory.known.apartment?.match(/\bmonoambiente\b|\b[123]\s*ambientes?\b/i)?.[0];
  const summary=apartment?(apartment.toLowerCase()==='monoambiente'?'Vi que buscás un departamento monoambiente. ':'Vi que buscás un departamento de '+apartment.toLowerCase()+'. '):'';
  return template.replaceAll('{{nameSuffix}}',safeName?', '+safeName:'').replaceAll('{{searchSummary}}',summary);
}
