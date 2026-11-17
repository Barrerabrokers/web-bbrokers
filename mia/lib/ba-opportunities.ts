import { normalize, projectMention, roomCount, type Memory } from './ba-memory';
import projects from './ba-opportunities.json';
import { catalogBudget } from './catalog-options';
import { verifiedBrochureUrl } from './brochure';
import { MIA_MESSAGE_BOUNDARY } from '@/lib/mia-reply-messages';

const money = (v: number) => 'USD ' + v.toLocaleString('es-AR', {maximumFractionDigits: 2});

type Project = (typeof projects)[number];
const requiresUnitVerification = (p: Project) =>
  !!p.error || /^(?:vidal|belnovo olleros|newbery place|cramer 2848|larralde 2362|dorrego place)\b/.test(normalize(p.edificio));
const mapsUrl = (p: Project) =>
  'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.direccion + ' Buenos Aires');

function neighborhoodOverview(scope: Project[]) {
  return scope.flatMap(p => {
    const address = [p.direccion, p.cruce ? 'cruza ' + p.cruce : null].filter(Boolean).join(', ');
    const delivery = [p.entrega,p.etapa].filter(Boolean).join(' · ');
    const master = [p.forma_pago_master,p.precio_m2_master ? p.precio_m2_master + '/m²' : null,
      p.garage ? 'garage: ' + p.garage.toLowerCase() : null].filter(Boolean).join(' · ');
    const brochure = verifiedBrochureUrl(p.brochure);
    const messages = [[p.edificio + ' — ' + address, ...(delivery ? ['Entrega / etapa: ' + delivery] : []), 'Maps: ' + mapsUrl(p)]];
    const details = [
      ...(master ? ['Datos del master: ' + master] : []),
      ...(requiresUnitVerification(p) ? ['El agente te verifica la unidad puntual.'] : []),
      ...(brochure ? ['Brochure: ' + brochure] : []),
    ];
    if (details.length) messages.push(details);
    return messages;
  });
}

export function baCatalogReply(latest: string, recent: string[], memory: Memory = {}) {
  const intent = normalize(latest);
  const wantsInfo = /\b(?:info|informacion|ubicacion|mapa|maps|direccion|unidades|brochure|folleto|entrega|etapa)\b/.test(intent);
  const wantsPrices = /\b(?:precios?|valores?|cuanto (?:cuesta|sale|vale)|cotizacion)\b/.test(intent);
  const wantsAll = /\b(?:pasame|mandame|mostrame|contame|quiero ver)\b.{0,32}\b(?:todo|todos|todas|los otros|las otras|el resto)\b/.test(intent);
  const search = /\b(?:otras?|mas opciones|alternativas|mostrame|busco|prefiero|para vivir|para invertir|anticipo|cuotas?|ambientes?|studio|monoambiente)\b/.test(intent);
  const hasBudget = memory.anticipo_objetivo !== undefined && memory.cuota_objetivo !== undefined;
  const quote = wantsPrices || search && !!memory.barrio_busca && !!memory.ambientes_busca?.length && (hasBudget || memory.anticipo_objetivo !== undefined || memory.cuota_objetivo !== undefined);
  const anticipo = quote ? memory.anticipo_objetivo ?? null : null;
  const cuota = quote ? memory.cuota_objetivo ?? null : null;
  const total = anticipo === null && cuota === null ? catalogBudget(latest).total : null;
  if (!wantsAll && !wantsInfo && !quote && anticipo === null && cuota === null && total === null) return null;

  const explicit = projectMention(latest);
  const historic = recent.slice(-5).reverse().map(projectMention).find(Boolean);
  const active = projects.find(p=>p.direccion===memory.proyecto_activo);
  const project = explicit ?? active ?? (wantsInfo ? historic : undefined);
  const zone = memory.barrio_busca;
  const byZone = zone === 'Palermo' ? projects.filter(p=>p.barrio.startsWith('Palermo')) :
    projects.filter(p=>p.barrio===zone);
  if (wantsAll && byZone.length) {
    return {shown:[], activeProject:undefined, missingBrochure:null,
      reply:neighborhoodOverview(byZone).map(part=>part.join('\n')).join(MIA_MESSAGE_BOUNDARY)};
  }
  if (!project && !quote && total === null) return null;
  const shown: string[] = [];
  const unitKey = (p: (typeof projects)[number], u: (typeof projects)[number]['unidades'][number]) =>
    [p.direccion,u.id,u.m2,u.total].join('|');
  const lines: string[][] = [];
  if (project && quote && requiresUnitVerification(project) && !wantsInfo) {
    return {shown, activeProject:project.direccion, missingBrochure:null,
      reply:neighborhoodOverview([project]).map(part=>part.join('\n')).join(MIA_MESSAGE_BOUNDARY)};
  }
  if (project && wantsInfo) {
    const {direccion,barrio,cruce,entrega,etapa} = project;
    const maps = mapsUrl(project);
    const brochure = verifiedBrochureUrl(project.brochure);
    lines.push([
      'Ubicación: ' + [direccion,barrio,cruce ? 'esquina o cruce con ' + cruce : null].filter(Boolean).join(', ') + '.',
      'Maps: ' + maps,
      requiresUnitVerification(project) ? 'Unidades: el agente te verifica la unidad puntual.' : 'Unidades: ' + project.disponibles + ' disponibles de ' + project.total + '.',
    ], [
      brochure ? 'Brochure: ' + brochure : 'Brochure pendiente.',
      'Entrega / etapa: ' + [entrega,etapa].filter(Boolean).join(' · '),
    ]);
  }
  if (quote || total !== null) {
    const scope = project ? [project] : zone ? byZone : projects;
    const options = scope.filter(p=>!requiresUnitVerification(p)).flatMap(p => p.unidades.map(u=>({p,u})))
      .filter(({p,u}) => !(memory.unidades_mostradas ?? []).includes(unitKey(p,u)) && !/^local\b/i.test(u.id ?? '')
        && (!memory.ambientes_busca?.length || memory.ambientes_busca.includes(roomCount(u.ambientes) ?? 0)) && (anticipo === null || u.anticipo !== null) && (cuota === null || u.cuota !== null));
    const distance = (u: typeof options[number]['u']) =>
      (anticipo === null ? 0 : Math.abs(u.anticipo! - anticipo)) +
      (cuota === null ? 0 : Math.abs(u.cuota! - cuota) * 10) +
      (total === null ? 0 : Math.abs(u.total - total));
    options.sort((a,b) => distance(a.u) - distance(b.u) || a.u.total - b.u.total);
    const budget = anticipo !== null || cuota !== null || total !== null;
    const exact = budget ? options.filter(({u})=>distance(u)===0) : [];
    const picked = options.slice(0,2);
    shown.push(...picked.map(({p,u})=>unitKey(p,u)));
    if (!picked.length) {
      lines.push([project && requiresUnitVerification(project) ? 'Las unidades de ' + project.direccion + ' las verifica el agente. Entrega / etapa: ' + [project.entrega,project.etapa].filter(Boolean).join(' · ') :
        'Por ahora no encontré más unidades verificadas para esos filtros. ¿Querés que revisemos otros ambientes o un barrio cercano?']);
    } else {
      const label = [anticipo !== null ? 'anticipo de '+money(anticipo) : null, cuota !== null ? 'cuota de '+money(cuota) : null, total !== null ? 'presupuesto de '+money(total) : null].filter(Boolean).join(' y ');
      lines.push([
        budget ? (exact.length === picked.length ? 'Coincidencia exacta para tu ' : 'Lo más cercano a tu ') + label + ':' : 'Estas son las opciones verificadas:',
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
  if (!lines.length) return null;
  return {shown, activeProject:project?.direccion, reply:lines.map(part=>part.join('\n')).join(MIA_MESSAGE_BOUNDARY), missingBrochure:project && wantsInfo && !verifiedBrochureUrl(project.brochure) ? project.direccion : null};
}
