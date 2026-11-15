import { deliveryMonths, type SheetUnit } from './development-sheet';

const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function optionsRequested(text: string) {
  const value = normalize(text);
  return /\b(?:opciones|alternativas)\b/.test(value)
    && /\b(?:pasa|pasame|enviame|mandame|mostra|mostrame|quiero|busco|ver|dos|2)\b/.test(value);
}

export function requestedRoomCounts(text: string) {
  const value = normalize(text);
  return [
    ...(/\b(?:monoambiente|(?:1|un)\s+ambientes?)\b/.test(value) ? [1] : []),
    ...(/\b(?:(?:2|dos)\s+ambientes?)\b/.test(value) ? [2] : []),
  ];
}

export function optionsZone(evidence: string[]) {
  for (const text of evidence) {
    const value = normalize(text);
    if (/\b(?:nunez|parque (?:de la )?innovacion)\b/.test(value)) return 'nunez';
    if (/\bpalermo\b/.test(value)) return 'palermo';
    if (/\bbelgrano\b/.test(value)) return 'belgrano';
    if (/\brecoleta\b/.test(value)) return 'recoleta';
  }
  return null;
}

export function catalogFactsRequested(text: string) {
  const value = normalize(text);
  return /\b(?:cuanto (?:sale|cuesta|vale)|que precio|precio de|sigue disponible|hay disponibilidad|cuando (?:es la entrega|entregan|se entrega)|fecha de entrega)\b/.test(value);
}

export function unverifiedCatalogClaim(text: string) {
  const value = normalize(text).replace(/\s+/g, ' ');
  return /\b(?:te (?:preparo|envi[oó]|mando|paso|muestro|comparto)|voy a (?:buscar|preparar|enviar)|tengo)\b.{0,80}\b(?:opciones|alternativas|unidades)\b/.test(value)
    || /\b(?:disponibilidad inmediata|entrega inmediata|stock disponible|listo para (?:mudarte|entregar)|(?:unidad|departamento|depto|opcion).{0,38}disponible)\b/.test(value)
    || /\b(?:entrega|entregan|se entrega)\b.{0,30}\b(?:20\d{2}|\d+ meses)\b/.test(value)
    || /\b(?:usd|ars|u\$s)\s*[\d.]|\$\s*\d|\b\d[\d.,]*\s*(?:dolares|pesos)\b/.test(value);
}

export function renderVerifiedOptions(options: SheetUnit[], missing: number[] = []) {
  const pending = new Set<string>();
  const lines = options.map((option, index) => {
    const {project} = option;
    const originalType = /\bstudio\b/i.test(option.originalType ?? '') ? 'Studio' : option.originalType;
    const rooms = option.roomCount === 1
      ? `1 ambiente tipo ${originalType}` : `${option.roomCount} ambientes`;
    const link = project.brochure_url ? 'Brochure ' + project.brochure_url : 'Lista de precios ' + project.listUrl;
    if (!project.brochure_url) pending.add(project.id);
    const delivery = deliveryMonths(project.delivery) === 0 ? 'Entrega inmediata' : 'Entrega ' + project.delivery;
    const availability = /^disponible|^available/i.test(option.availability ?? '') ? 'Disponible' : option.availability;
    return `Opción ${index + 1}: ${project.name} - ${project.address}, ${project.location} - ${rooms} - ${option.price} - ${availability} - ${delivery} - ${link}`;
  });
  if (pending.size) lines[lines.length - 1] += pending.size === 1
    ? ' — El brochure de este proyecto está pendiente, te comparto la lista de precios.'
    : ' — Los brochures de estos proyectos están pendientes, te comparto las listas de precios.';
  return lines.join('\n') + (options.length === 2
    ? '\n¿Cuál querés que te detalle primero, la de 1 o la de 2?'
    : missing.length
      ? `\nLa opción de ${missing[0]} ${missing[0] === 1 ? 'ambiente' : 'ambientes'} queda para que la verifique un agente.\n¿Qué te gustaría saber de la opción disponible?`
      : '\n¿Qué te gustaría saber de la opción disponible?');
}
