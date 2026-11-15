import type { MiaDeliveryPreference } from './mia-delivery-preference';
import type { AgentProject } from './mia-agent-search';
const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function miaPublishedDelivery(project:AgentProject,now=new Date()){
 const raw=normalize(project.completionDate||'');const named=raw.match(/^(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?: de)? (20\d{2})$/),iso=raw.match(/^(20\d{2})-(0[1-9]|1[0-2])(?:-\d{2})?$/);
 if(!named&&!iso)return null;
 const year=Number(named?.[2]||iso?.[1]),month=named?months.indexOf(named[1]):Number(iso![2])-1;
 const first=Date.UTC(year,month,1),last=Date.UTC(year,month+1,0,23,59,59),limit=new Date(now);limit.setUTCFullYear(limit.getUTCFullYear()+1);
 const timing=last<now.getTime()?'past':last<=limit.getTime()?'within_year':first>limit.getTime()?'beyond_year':'boundary';
 return {text:months[month]+' de '+year,timing,year,month};
}
export const miaPublishedState=(status?:string)=>({en_construccion:'en construcción',pre_venta:'en preventa',finalizado:'finalizado',entregado:'entregado'}[status||'']);
export function miaProjectFacts(project:AgentProject,now=new Date()){
 const date=miaPublishedDelivery(project,now),today=new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',dateStyle:'long'}).format(now);
 return ['Proyecto: '+project.name,project.neighborhood?'Ubicación publicada: '+project.neighborhood:'',miaPublishedState(project.status)?'Estado publicado: '+miaPublishedState(project.status):'',date?'Entrega estimada publicada: '+date.text:'', 'Fecha actual: '+today,date?.timing==='within_year'?'El mes de entrega publicado está dentro de los próximos 12 meses; la fecha exacta y disponibilidad requieren confirmación.':date?.timing==='beyond_year'?'El mes de entrega publicado queda después de los próximos 12 meses.':date?.timing==='past'?'La fecha de entrega publicada ya pasó. Eso no confirma finalización ni disponibilidad; verificar avance con el equipo.':date?.timing==='boundary'?'El mes de entrega coincide con el límite de 12 meses. Falta confirmar el día exacto.':''].filter(Boolean).join('\n');
}
export function miaDeliveryFit(project:AgentProject,preference:MiaDeliveryPreference|null|undefined,now=new Date()){
 const published=miaPublishedDelivery(project,now);if(!published||!preference||published.timing==='past')return null;
 const limit=new Date(preference.anchorAt);limit.setUTCMonth(limit.getUTCMonth()+preference.targetMonths);
 const first=Date.UTC(published.year,published.month,1),last=Date.UTC(published.year,published.month+1,0,23,59,59);
 const extraMonths=Math.max(0,(published.year-limit.getUTCFullYear())*12+published.month-limit.getUTCMonth());
 const status=last<=limit.getTime()?'within':first<=limit.getTime()?'boundary':!preference.strict&&extraMonths<=preference.toleranceMonths?'nearby':'outside';
 return {status,extraMonths,accepted:preference.acceptedProjects.includes(project.name),rejected:preference.rejectedProjects.includes(project.name)};
}
export type MiaProjectOverviewOptions={deliveryPreference?:MiaDeliveryPreference|null;previousReplies?:string[];brochureSent?:boolean};
export function miaProjectOverview(project:AgentProject,deadline:boolean|MiaProjectOverviewOptions=false,now=new Date()){
 const options: MiaProjectOverviewOptions=typeof deadline==='boolean'?{deliveryPreference:deadline?{targetMonths:12,anchorAt:now.toISOString(),strict:false,toleranceMonths:3,acceptedProjects:[],rejectedProjects:[],evidence:''}:null}:deadline;
 const date=miaPublishedDelivery(project,now),state=miaPublishedState(project.status),fit=miaDeliveryFit(project,options.deliveryPreference,now),previous=options.previousReplies||[];
 const repeated=previous.some(r=>r.includes(project.name)&&/entrega|construcci[oó]n|ficha oficial/i.test(r));
 const alreadyAsked=previous.some(r=>/¿[^?]*(?:meses adicionales|margen[^?]*sirve|esperar esos meses)[^?]*\?/i.test(r));
 const lines=[repeated?'Seguimos con '+project.name+'.':project.name+(state?' está publicado '+state:' figura en nuestro catálogo público')+(project.neighborhood?', en '+project.neighborhood:'')+'.'];
 if(date)lines.push('La entrega estimada publicada es '+date.text+'.');
 if(date?.timing==='past')lines.push('Esa fecha ya pasó: necesitamos confirmar el avance actual; no implica que esté terminado.');
 if(fit?.accepted)lines.push('Tengo presente que aceptaste ese margen de entrega para este proyecto.');
 else if(fit?.rejected)lines.push('Tengo presente que este plazo no te servía; lo conservo como referencia, sin volver a proponértelo para esa búsqueda.');
 else if(fit?.status==='nearby')lines.push('Queda unos meses después del plazo orientativo que buscabas. Puede ser una alternativa cercana si ese margen te sirve; la fecha estimada no es una entrega garantizada.');
 else if(fit?.status==='outside')lines.push(options.deliveryPreference?.strict?'Ese plazo supera el límite estricto que marcaste; no lo tomo como una opción compatible sin que vos cambies esa condición.':'Este plazo se aleja del objetivo que marcaste; necesitaríamos revisar si querés ampliar ese margen.');
 else if(fit?.status==='boundary')lines.push('El mes publicado está cerca del límite; falta confirmar el día exacto de entrega.');
 if(!previous.some(r=>r.includes('https://barrerabrokers.com/desarrollos/'+project.slug)))lines.push('Ficha oficial: [[LINK:'+project.slug+':website]]');
 if(fit?.status==='nearby'&&!fit.accepted&&!fit.rejected&&!alreadyAsked)lines.push('¿Te sirven esos meses adicionales?');
 else if(fit?.status==='outside'&&options.deliveryPreference?.strict)lines.push('Voy a priorizar alternativas que respeten ese límite.');
 else if(options.brochureSent)lines.push('Ya compartí el brochure; podemos avanzar con las dudas concretas del proyecto.');
 else if(!previous.some(r=>/¿[^?]*brochure[^?]*\?/i.test(r)))lines.push('¿Querés que te comparta el brochure del proyecto?');
 else lines.push('Podemos seguir con las características y las unidades que encajen con tu búsqueda.');
 return lines.join('\n\n');
}
