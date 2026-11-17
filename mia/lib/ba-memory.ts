import projects from './ba-opportunities.json';

export type Memory = {
  nombre?: string;
  barrio_busca?: string;
  ambientes_busca?: number[];
  para_que?: 'vivir' | 'invertir' | 'ambos';
  anticipo_objetivo?: number;
  cuota_objetivo?: number;
  entrega_objetivo?: string;
  proyecto_activo?: string;
  unidades_mostradas?: string[];
  ultimas_unidades?: string[];
  ultimo_tema?: string;
};

export const normalize = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim();

export function projectMention(text: string) {
  const words = ' ' + normalize(text) + ' ';
  const hits = projects.filter(p => [p.edificio, p.direccion, p.direccion.replace(/^Manuel Ugarte/i, 'Ugarte')]
    .some(v => normalize(v).length >= 4 && words.includes(' ' + normalize(v) + ' ')));
  return hits.length === 1 ? hits[0] : undefined;
}

export function roomCount(value: string | null) {
  const v = normalize(value ?? '');
  if (/\b(?:mono|monoambiente|studio|un ambiente)\b/.test(v)) return 1;
  return Number(/^(\d)(?: |$)/.exec(v)?.[1]) || null;
}

export function amount(text: string, label: string) {
  const m = new RegExp(label + '\\s*(?:(?:de|hasta)\\s+)?(?:(?:usd|u\\$s|us\\$|\\$)\\s*)?([\\d.,]+)(\\s*mil\\b)?', 'i').exec(text);
  if (!m) return undefined;
  const n = Number(m[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.')) * (m[2] ? 1000 : 1);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function updateBaMemory(previous: Memory, latest: string, name: string, nameRequested: boolean, deliveryRequested = false): Memory {
  const text = normalize(latest);
  const words = ' ' + text + ' ';
  const supplied = /^(?:hola[!, ]+)?(?:me llamo|mi nombre es|soy)\s+([\p{L}][\p{L}' -]{0,50})(?=[.,!]|$)/iu.exec(latest)?.[1]
    ?? (nameRequested ? /^([\p{L}][\p{L}' -]{0,40}),\s*(?:busco|quiero|me interesa|para vivir|para invertir)\b/iu.exec(latest)?.[1] : undefined)
    ?? (nameRequested && /^[\p{L}]+(?:[ '-][\p{L}]+){0,2}[.!]?$/u.test(latest.trim()) &&
      !/\b(?:hola|gracias|ok|si|no|busco|palermo|nunez|belgrano|recoleta|barracas|san telmo)\b/.test(text) ? latest.replace(/[.!]+$/, '') : '');
  const known = supplied || (name && !/^(?:contacto|whatsapp|consulta|desconocido)\b/i.test(name) ? name : '');
  const detectedNeighborhood = [...new Set(projects.map(p=>p.barrio))].sort((a,b)=>b.length-a.length)
    .find(zone=>words.includes(' ' + normalize(zone) + ' '))
    ?? (previous.barrio_busca?.startsWith('Palermo') && /\bhollywood\b/.test(text) ? 'Palermo Hollywood' : undefined);
  const rooms = [...text.matchAll(/\b([1-4])(?:\s+o\s+([1-4]))?\s+amb(?:ientes?)?\b/g)].flatMap(m=>[Number(m[1]),...(m[2]?[Number(m[2])]:[])]);
  if (/\b(?:studio|monoambiente|un ambiente)\b/.test(text)) rooms.push(1);
  const choice = /^(?:me interesa |prefiero |quiero |me gusta )?(?:la )?(primera|segunda|opcion 1|opcion 2)$/.exec(text)?.[1];
  const index = choice && /primera|1$/.test(choice) ? 0 : 1;
  const selectedAddress = choice ? previous.ultimas_unidades?.[index]?.split('|')[0] : undefined;
  const project = projectMention(latest) ?? projects.find(p=>p.direccion===selectedAddress);
  const neighborhood = detectedNeighborhood ?? project?.barrio ?? previous.barrio_busca;
  const vivir = /\bvivir\b/.test(text), invertir = /\binvertir\b/.test(text);
  const delivery = (deliveryRequested && /^(?:inmediata|ya|(?:en )?\d{1,2} meses|20\d{2})$/.test(text) ? text : undefined) ?? /\b(?:entrega|mudarme|mudarnos)\b.{0,24}\b(?:inmediata|(?:en )?\d{1,2} meses|20\d{2})\b/.exec(text)?.[0];
  return {...previous, nombre:known.trim().split(/\s+/)[0] || previous.nombre,
    barrio_busca:neighborhood, ambientes_busca:rooms.length?[...new Set(rooms)]:previous.ambientes_busca,
    para_que:vivir&&invertir||text==='ambos'?'ambos':vivir?'vivir':invertir?'invertir':previous.para_que,
    anticipo_objetivo:amount(latest,'\\banticipo')??previous.anticipo_objetivo,
    cuota_objetivo:amount(latest,'\\bcuotas?')??previous.cuota_objetivo,
    entrega_objetivo:delivery??previous.entrega_objetivo,
    proyecto_activo:project?.direccion ?? (detectedNeighborhood ? undefined : previous.proyecto_activo),
  };
}
