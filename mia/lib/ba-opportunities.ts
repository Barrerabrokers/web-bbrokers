import projects from './ba-opportunities.json';
import { catalogBudget } from './catalog-options';
import { verifiedBrochureUrl } from './brochure';
import { MIA_MESSAGE_BOUNDARY } from '@/lib/mia-reply-messages';

const normalize = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim();
const money = (v: number) => 'USD ' + v.toLocaleString('es-AR', {maximumFractionDigits: 2});

function amount(text: string, label: string) {
  const m = new RegExp(label + '\\s*(?:(?:de|hasta)\\s+)?(?:(?:usd|u\\$s|us\\$|\\$)\\s*)?([\\d.,]+)(\\s*mil\\b)?', 'i').exec(text);
  if (!m) return null;
  const n = Number(m[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.')) * (m[2] ? 1000 : 1);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function baCatalogReply(latest: string, recent: string[]) {
  const intent = normalize(latest);
  const wantsInfo = /\b(?:info|informacion|ubicacion|mapa|maps|direccion|unidades|brochure|folleto|entrega|etapa)\b/.test(intent);
  const wantsPrices = /\b(?:precios?|valores?|cuanto (?:cuesta|sale|vale)|cotizacion)\b/.test(intent);
  const anticipo = amount(latest, '\\banticipo');
  const cuota = amount(latest, '\\bcuotas?');
  const total = anticipo === null && cuota === null ? catalogBudget(latest).total : null;
  if (!wantsInfo && !wantsPrices && anticipo === null && cuota === null && total === null) return null;

  let project: (typeof projects)[number] | undefined;
  for (const message of [latest, ...recent.slice(-5).reverse()]) {
    const words = ' ' + normalize(message) + ' ';
    const matches = projects.filter(p => {
      const address = normalize(p.direccion);
      const shortAddress = address.replace(/^manuel ugarte\b/, 'ugarte');
      return [normalize(p.edificio), address, shortAddress].some(key => key.length >= 4 && words.includes(' ' + key + ' '));
    });
    if (matches.length > 1) break;
    if (matches.length === 1) {
      [project] = matches;
      break;
    }
  }

  const zone = projects.find(p => (' ' + intent + ' ').includes(' ' + normalize(p.barrio) + ' '))?.barrio;
  if (!project && !wantsPrices && anticipo === null && cuota === null && total === null) return null;
  const lines: string[][] = [];
  if (project && wantsInfo) {
    const {direccion,barrio,cruce,entrega,etapa} = project;
    const maps = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(direccion + ' Buenos Aires');
    const brochure = verifiedBrochureUrl(project.brochure);
    lines.push([
      'Ubicación: ' + [direccion,barrio,cruce ? 'esquina o cruce con ' + cruce : null].filter(Boolean).join(', ') + '.',
      'Maps: ' + maps,
      project.error ? 'Unidades: listado pendiente de verificar.' : 'Unidades: ' + project.disponibles + ' disponibles de ' + project.total + '.',
    ], [
      brochure ? 'Brochure: ' + brochure : 'Brochure pendiente.',
      'Entrega / etapa: ' + [entrega,etapa].filter(Boolean).join(' · '),
    ]);
  }
  if (wantsPrices || anticipo !== null || cuota !== null || total !== null) {
    const scope = project ? [project] : zone ? projects.filter(p=>p.barrio===zone) : projects;
    const options = scope.flatMap(p => p.unidades.map(u=>({p,u})))
      .filter(({u}) => !/^local\b/i.test(u.id ?? '') && (anticipo === null || u.anticipo !== null) && (cuota === null || u.cuota !== null));
    const distance = (u: typeof options[number]['u']) =>
      (anticipo === null ? 0 : Math.abs(u.anticipo! - anticipo) / anticipo) +
      (cuota === null ? 0 : Math.abs(u.cuota! - cuota) / cuota) +
      (total === null ? 0 : Math.abs(u.total - total) / total);
    options.sort((a,b) => distance(a.u) - distance(b.u) || a.u.total - b.u.total);
    const budget = anticipo !== null || cuota !== null || total !== null;
    const exact = budget ? options.filter(({u})=>distance(u)===0) : [];
    const picked = (exact.length ? exact : options).slice(0,2);
    if (!picked.length) {
      lines.push(['La lista de precios de ' + (project?.direccion ?? 'esa búsqueda') + ' no tiene unidades con importes verificables.']);
    } else {
      const label = [anticipo !== null ? 'anticipo de '+money(anticipo) : null, cuota !== null ? 'cuota de '+money(cuota) : null, total !== null ? 'presupuesto de '+money(total) : null].filter(Boolean).join(' y ');
      lines.push([
        budget ? (exact.length ? 'Coincidencia exacta para tu ' : 'Lo más cercano a tu ') + label + ':' : 'Valores de la lista de precios:',
        ...picked.map(({p,u}) => [
          (project ? '' : p.direccion + ' · ') + 'Unidad ' + u.id,
          u.ambientes ?? 'ambientes sin confirmar',
          u.m2 === null ? 'm² sin confirmar' : u.m2.toLocaleString('es-AR') + ' m²',
          'total ' + money(u.total),
          u.anticipo === null ? 'anticipo sin confirmar' : 'anticipo ' + money(u.anticipo),
          u.cuotas && u.cuota !== null ? u.cuotas + ' cuotas de ' + money(u.cuota) : u.posesion !== null ? 'posesión ' + money(u.posesion) : u.cuotas === 0 ? 'sin cuotas' : 'cuotas sin confirmar',
        ].join(' · ')),
      ]);
    }
  }
  return {reply:lines.map(part=>part.join('\n')).join(MIA_MESSAGE_BOUNDARY), missingBrochure:project && wantsInfo && !verifiedBrochureUrl(project.brochure) ? project.direccion : null};
}
