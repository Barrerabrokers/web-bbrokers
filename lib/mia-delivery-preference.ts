export type MiaDeliveryPreference={targetMonths:number;anchorAt:string;strict:boolean;toleranceMonths:number;acceptedProjects:string[];rejectedProjects:string[];evidence:string};
const clean=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
export function learnMiaDeliveryPreference(previous:MiaDeliveryPreference|null|undefined,text:string,at=new Date().toISOString(),previousReply='',project?:string){
 const t=clean(text);let preference=previous?{...previous,acceptedProjects:[...previous.acceptedProjects],rejectedProjects:[...previous.rejectedProjects]}:null;
 let accepted=false,rejected=false;
 if(/nueva busqueda|empecemos de cero|olvida (?:la |lo )?anterior/.test(t))preference=null;
 const explicit=/^(?:un|1) ano[.! ]*$/.test(t)||/\b(?:en|dentro de|menos de|no mas de|no puedo esperar mas de|alrededor de|aproximadamente|maximo|hasta|a lo sumo)\s+(?:un|1) ano\b/.test(t)||/que (?:se termine|termine|entreguen).{0,30}\b(?:un|1) ano\b/.test(t);
 const months=t.match(/\b(?:en|dentro de|menos de|no mas de|no puedo esperar mas de|alrededor de|aproximadamente|maximo|hasta|a lo sumo)\s+(\d{1,2}|seis|doce|dieciocho|veinticuatro) meses\b/);
 const names:Record<string,number>={seis:6,doce:12,dieciocho:18,veinticuatro:24};
 const strict=/\b(?:maximo|como maximo|si o si|fecha limite|innegociable|no puedo esperar mas|no me sirve esperar mas|sin excepcion|plazo estricto)\b/.test(t);
 if(explicit||months){const targetMonths=explicit?12:names[months![1]]||Number(months![1]);if(targetMonths>=1&&targetMonths<=60)preference={targetMonths,anchorAt:Number.isFinite(Date.parse(at))?new Date(at).toISOString():new Date().toISOString(),strict,toleranceMonths:strict?0:3,acceptedProjects:[],rejectedProjects:[],evidence:text.slice(0,500)};}
 else if(/entrega inmediata|terminad[oa] ya|list[oa] para mudarme|necesito mudarme (?:ya|ahora)/.test(t))preference=null;
 else if(preference&&strict)preference={...preference,strict:true,toleranceMonths:0,acceptedProjects:[],evidence:text.slice(0,500)};
 const year=t.match(/(?:entrega|entreguen|terminad[oa]|para|hasta|antes de).{0,20}\b(20\d{2})\b/)||t.match(/^(20\d{2})(?: me sirve| esta bien| puede ser| si)?$/);
 if(year&&!explicit&&!months){const anchor=new Date(at),target=Number(year[1]);const names=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];const month=names.findIndex(m=>new RegExp('\\b'+m+'(?: de)? '+year[1]+'\\b').test(t));const endMonth=month>=0?month:/antes de (?:el )?20\d{2}/.test(t)?-1:11;const delta=(target-anchor.getUTCFullYear())*12+endMonth-anchor.getUTCMonth();if(Number.isFinite(anchor.getTime())&&delta>=1&&delta<=60)preference={targetMonths:delta,anchorAt:anchor.toISOString(),strict:true,toleranceMonths:0,acceptedProjects:[],rejectedProjects:[],evidence:text.slice(0,500)};}
 const flexible=/puedo esperar|no es estricto|no es un limite|no tengo apuro|no tengo (?:una )?fecha limite|un(?:os)? meses mas|unos meses despues|el plazo es flexible|soy flexible/.test(t)&&!/no puedo esperar|no me sirve|no acepto/.test(t);
 if(preference&&flexible){const extra=t.match(/(?:hasta |unos? )?(\d|uno|dos|tres) meses (?:mas|adicionales)/);const n=extra?({uno:1,dos:2,tres:3}[extra[1]]||Number(extra[1])):3;preference={...preference,strict:false,toleranceMonths:Math.min(6,n),evidence:text.slice(0,500)};}
 const question=(previousReply.match(/¿[^?]*\?|[^.!?\n]+\?/g)||[]).at(-1)||'';
 const negotiating=/margen|meses (?:adicionales|mas)|esperar esos|ese plazo/.test(clean(question));
 const yes=!/\b(?:pero|no|todavia|aun)\b/.test(t)&&/^(?:si|dale|perfecto|de acuerdo|me sirve|esta bien|puedo esperar|si me sirve|si puedo esperar|ok|bueno)(?:[,.! ]|$)/.test(t);
 const no=/^(?:no|no me sirve|no puedo esperar|prefiero que no)(?:[,.! ]|$)/.test(t);
 if(preference&&project&&negotiating){
  if(yes&&!preference.strict){accepted=true;preference.acceptedProjects=Array.from(new Set([...preference.acceptedProjects,project])).slice(-30);preference.rejectedProjects=preference.rejectedProjects.filter(p=>p!==project);preference.evidence=text.slice(0,500);}
  else if(no){rejected=true;preference.rejectedProjects=Array.from(new Set([...preference.rejectedProjects,project])).slice(-30);preference.acceptedProjects=preference.acceptedProjects.filter(p=>p!==project);preference.evidence=text.slice(0,500);}
 }
 return {preference,accepted,rejected};
}
export function recoverMiaDeliveryPreference(previous:MiaDeliveryPreference|null|undefined,messages:{direction:string;content:string;createdAt?:string}[],crmContext?:string){
 if(previous)return previous;
 let preference:MiaDeliveryPreference|null=null;const events:{text:string;at:string}[]=[];
 try{const crm=JSON.parse(crmContext||'{}');for(const e of crm.history||crm.events||[])if(e.direccion==='inbound')events.push({text:e.detalle,at:e.fecha});}catch{/* Partial or absent context cannot supply preferences. */}
 for(const m of messages)if(m.direction==='inbound')events.push({text:m.content,at:m.createdAt||new Date().toISOString()});
 for(const e of events.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)))preference=learnMiaDeliveryPreference(preference,String(e.text||''),e.at).preference;
 return preference;
}
export function miaDeliveryPreferenceSummary(p:MiaDeliveryPreference|null|undefined){
 return p?[`Entrega buscada: ${p.targetMonths} meses desde ${p.anchorAt.slice(0,10)}`,p.strict?'Límite estricto: no ampliar sin nueva instrucción del cliente':`Plazo orientativo: se pueden proponer hasta ${p.toleranceMonths} meses adicionales como alternativa, con confirmación del cliente`,p.acceptedProjects.length?'Margen aceptado para: '+p.acceptedProjects.join(', '):'',p.rejectedProjects.length?'Descartados por plazo: '+p.rejectedProjects.join(', '):''].filter(Boolean).join('. '):'';
}
