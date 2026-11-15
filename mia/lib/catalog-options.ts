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

export function unverifiedCatalogClaim(text: string) {
  const value = normalize(text).replace(/\s+/g, ' ');
  return /\b(?:te (?:preparo|envi[oó]|mando|paso|muestro|comparto)|voy a (?:buscar|preparar|enviar)|tengo)\b.{0,80}\b(?:opciones|alternativas|unidades)\b/.test(value)
    || /\b(?:disponibilidad inmediata|entrega inmediata|stock disponible|listo para (?:mudarte|entregar)|(?:unidad|departamento|depto|opcion).{0,38}disponible)\b/.test(value)
    || /\b(?:usd|ars|u\$s)\s*[\d.]|\$\s*\d|\b\d[\d.,]*\s*(?:dolares|pesos)\b/.test(value);
}

export type VerifiedOption = {
  name: string; unit_number: string; room_count: number; price: string;
  currency: string; slug: string;
};

export function renderVerifiedOptions(options: VerifiedOption[], missing: number[] = []) {
  return options.map((option, index) => {
    const price = Number(option.price).toLocaleString('es-AR', {maximumFractionDigits: 2});
    const rooms = option.room_count === 1 ? '1 ambiente' : `${option.room_count} ambientes`;
    const link = option.slug ? ` - https://barrerabrokers.com/desarrollos/${encodeURIComponent(option.slug)}` : '';
    return `Opción ${index + 1}: ${option.name} (unidad ${option.unit_number}) - ${rooms} - ${option.currency} ${price} - Disponible según CRM${link}`;
  }).join('\n') + (options.length === 2
    ? '\n¿Cuál querés que te detalle primero, la de 1 o la de 2?'
    : missing.length
      ? `\nLa opción de ${missing[0]} ${missing[0] === 1 ? 'ambiente' : 'ambientes'} queda para que la verifique un agente.\n¿Qué te gustaría saber de la opción disponible?`
      : '\n¿Qué te gustaría saber de esta opción?');
}
