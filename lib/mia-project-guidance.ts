import { selectMiaProjects } from '@/lib/mia-project-catalog';
import type { MiaGuidance } from '@/lib/mia-guidance';
const normalizeProject=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
/** Keep general instructions and complete project records; never cut a project in half. */
export function miaProjectGuidance(guidance:MiaGuidance,query:string) {
  const blocks=[...(guidance.instructions||'').matchAll(/\[([^\]\n]+) · [^\]\n]+\]\n[\s\S]*?\[Fin \1\]/g)].map(m=>({name:m[1],text:m[0]}));
  const general=blocks.reduce((text,b)=>text.replace(b.text,''),guidance.instructions||'').trim();
  const q=normalizeProject(query);
  const matches=blocks.filter(b=>q.includes(normalizeProject(b.name))).sort((a,b)=>q.lastIndexOf(normalizeProject(b.name))-q.lastIndexOf(normalizeProject(a.name)));
  const areas=[...new Set((guidance.approvedProjects||[]).flatMap(p=>[p.neighborhood,...p.nearbyAreas]))].filter(a=>q.includes(normalizeProject(a)));
  const relevant=areas.length?selectMiaProjects(guidance.approvedProjects||[],{neighborhoods:areas},query):[];
  const chosen=blocks.filter(b=>matches.includes(b)||relevant.some(p=>p.name===b.name)||!matches.length&&normalizeProject(b.name).split(' ').some(w=>w.length>4&&q.includes(w)));
  const tokens:Record<string,string>={};
  for(const b of chosen)Object.assign(tokens,guidance.approvedProjectValues?.[b.name]||{});
  return {instructions:general.slice(0,6000)+'\nProyectos registrados: '+blocks.map(b=>b.name).join(', ')+'\nCatálogo completo aprobado (respetar barrio real, tipología, entrega y financiación; las áreas cercanas se ofrecen como alternativas, nunca como ubicación exacta): '+JSON.stringify(guidance.approvedProjects||[])+'\nFichas aprobadas para esta consulta:\n'+chosen.map(b=>b.text).join('\n'),tokens};
}
