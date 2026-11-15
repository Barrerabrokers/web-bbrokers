import { isValueDiscussion } from '@/lib/whatsapp-sales-turn';
import type { WhatsAppAttachment } from '@/lib/whatsapp-attachment-policy';
import { asksBudgetAlternative, salesBudgetLimits, fitsSalesBudget } from '@/lib/whatsapp-sales-budget';
import { selectReferenceUnits } from '@/lib/whatsapp-project-knowledge';
import { buildSalesMemory, asksKnownQualification } from '@/lib/whatsapp-sales-memory';
/** WhatsApp auto-links punctuation literally; never leave Markdown wrappers on brochures. */
export function normalizeBrochureLinks(text:string, details:any[], selected?:any) {
  const target=(link:string)=>{
    const clean=link.replace(/[)\]}>.,;!*]+$/g,'');
    const match=details.find(p=>p.brochure_url && p.slug && (clean===p.brochure_url || clean===p.brochure?.url || clean.includes(`/desarrollos/${encodeURIComponent(p.slug)}/brochure`)));
    const project=match || (selected && /brochure|drive\.google|storage\/v1/i.test(clean) ? selected : undefined);
    return project?.brochure_url && project?.slug ? `https://barrerabrokers.com/desarrollos/${encodeURIComponent(project.slug)}/brochure` : undefined;
  };
  let reply=text.replace(/\[([^\]\n]*)\]\((https?:\/\/[^\s]+)\)/g,(original,label,link)=>{
    const url=target(link);return url ? `${label}\n${url}\n` : original;
  });
  reply=reply.replace(/[(\[]?https?:\/\/[^\s]+/g,(original)=>{
    const url=target(original.replace(/^[(\[]/,''));return url ? `\n${url}\n` : original;
  });
  return reply.replace(/\n{3,}/g,'\n\n').trim();
}
/** Validate customer-facing output independently of the model/provider. */
export function salesReplyViolations(text: string, recoleta: boolean) {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const problems: string[] = [];
  if (text.replace(/https?:\/\/\S+/g, '').split(/\s+/).filter(Boolean).length > 65 || text.length > 650) problems.push('length');
  if ((text.match(/\?/g) || []).length > 1 || /\|.*\|/.test(text)) problems.push('questionnaire');
  if (recoleta) {
    if (/\b(\d+)\s*(?:cuotas|meses|pagos)\b/g.test(normalized)) {
      for (const match of normalized.matchAll(/\b(\d+)\s*(?:cuotas|meses|pagos)\b/g)) if (Number(match[1]) > 36) problems.push('financing');
    }
    const visitOffer=normalized.replace(/(?:no (?:tiene|hay|cuenta con|ofrecemos|podemos ofrecer)|sin)\s+(?:un\s+)?(?:showroom|visitas?(?: a (?:la )?obra)?)/g,'');
    if (/showroom|visita|visitar|recorrer|tour/.test(visitOffer)) problems.push('visit');
    if (/(?:ajustar|reducir|negociar|bajar).{0,45}anticipo|anticipo.{0,45}(?:ajustar|reducir|negociar|bajar)/.test(normalized)) problems.push('unsupported-plan');
  }
  return problems;
}
/** Preserve a genuine recommendation only when its complete quote matches an affordable source row. */
export function groundedBudgetRecommendation(text:string,messages:{direction:string;content:string}[],catalog:any,crm:Record<string,unknown>={}) {
  const memory=buildSalesMemory(messages,crm);
  const latest=messages.filter(m=>m.direction==='inbound').at(-1)?.content||'';
  const budget=salesBudgetLimits(memory.known.budget);
  if(!asksBudgetAlternative(latest)||!budget.down||asksKnownQualification(text,memory))return false;
  if(messages.filter(m=>m.direction==='outbound').slice(-3).some(m=>m.content.trim()===text.trim()))return false;
  const quote=salesBudgetLimits(text);
  const months=text.match(/(\d+)\s*(?:pagos|cuotas)/i)?.[1];
  if(!quote.down||!quote.monthly||!months) {
    const rows=(catalog.details||[]).flatMap((p:any)=>p.operatorKnowledge?.referenceUnits||[]);
    const noAffordable=rows.length>0&&!rows.some((u:any)=>u.sourceStatus==='LIBRE'&&fitsSalesBudget(u,budget));
    const noOption=/no (?:encuentro|hay|figura|tenemos).{0,100}(?:opci[oó]n|unidad|alternativa)|ninguna (?:opci[oó]n|unidad)/i.test(text)&&/listas?|cat[aá]logo/i.test(text);
    const amounts=[...text.matchAll(/(?:U\$S|USD)\s*([\d.,]+)/gi)].map(m=>Number(m[1].replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.')));
    return noAffordable&&noOption&&!months&&amounts.every(n=>n===budget.down||n===budget.monthly)&&salesReplyViolations(text,false).length===0&&!/ya (?:deriv[eé]|contact[eé]|consult[eé])|garantiz|rentabilidad asegurada/i.test(text);
  }
  const focus=buildSalesMemory([{direction:'inbound',content:text}]).projectRequest;
  if(focus.length!==1)return false;
  const project=(catalog.details||[]).find((p:any)=>String(p.name).trim()===focus[0]);
  if(!project||salesReplyViolations(text,project.slug==='feel-recoleta').length)return false;
  const number=text.match(/\b(?:unidad|uf)\s*(\d{3,4})\b/i)?.[1];
  const rows=(project.operatorKnowledge?.referenceUnits||[]).filter((u:any)=>u.sourceStatus==='LIBRE'&&fitsSalesBudget(u,budget));
  const unit=rows.find((u:any)=>u.downPayment===quote.down&&(u.monthlyPaymentReference??u.monthlyPayment)===quote.monthly&&u.months===Number(months)&&(!number||String(u.unit)===number));
  if(!unit)return false;
  const area=text.match(/([\d.,]+)\s*m[²2]\s*Totales/i)?.[1];
  const balcony=text.match(/con\s*([\d.,]+)\s*m[²2]\s*de\s*Balc[oó]n/i)?.[1];
  const numeric=(v:string)=>Number(v.replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.'));
  if(!area||numeric(area)!==unit.totalArea)return false;
  if(balcony&&numeric(balcony)!==(unit.balconyArea??unit.balconySemiCoveredArea))return false;
  const rooms=/monoambiente|1\s*ambiente/i.test(text)?1:Number(text.match(/([23])\s*ambientes/i)?.[1]);
  if(rooms!==unit.rooms)return false;
  const floor=text.match(/\bpiso\s*(\d+)\b/i)?.[1];if(floor&&Number(floor)!==Number(unit.floor))return false;
  const sameRequirements=selectReferenceUnits(rows,JSON.stringify(memory.known)).some(u=>String(u.unit)===String(unit.unit));
  const smaller=unit.rooms===1&&/3\s*ambientes/i.test(memory.known.apartment||'')&&/alternativa|primer paso|empezar|unidad menor/i.test(text)&&!/no (?:quiero|acepto).{0,25}(?:monoambiente|1 ambiente)/i.test(messages.filter(m=>m.direction==='inbound').map(m=>m.content).join(' '));
  if(!sameRequirements&&!smaller)return false;
  if(/CAC|pesific/i.test(project.operatorKnowledge?.priceList?.payment||'')&&!/ajust|CAC|pesific/i.test(text))return false;
  if(!/confirmar|referencia|vigencia pendiente/i.test(text))return false;
  return true;
}
export function finalizeSalesReply(text: string, messages: {direction:string;content:string;attachment?:WhatsAppAttachment}[], catalog:any, crm:Record<string,unknown> = {}) {
  const details = catalog.details || [];
  const incoming = messages.filter(m => m.direction === 'inbound').map(m => m.content).join('\n');
  const latest = messages.filter(m => m.direction === 'inbound').at(-1)?.content || '';
  const personalDisclosure = /herencia|falleci[oó]|muri[oó]|duelo|c[aá]ncer/i.test(latest) && !/quiero (?:invertir|comprar|reservar)|(?:mand|envi|pas)[aá](?:me)?|brochure|propuesta|precio|cuota|anticipo|informaci[oó]n/i.test(latest);
  const explicit = details.filter((p:any) => p.explicitlyMentioned);
  const project = explicit.length === 1 ? explicit[0] : details.length === 1 ? details[0] : undefined;
  const recoleta = project?.slug === 'feel-recoleta' || (!project && /feel\s+recoleta/i.test(incoming));
  const memory=buildSalesMemory(messages,crm);
  let reply = normalizeBrochureLinks(text.trim(), details, project);
  if(groundedBudgetRecommendation(reply,messages,catalog,crm))return reply;
  // Discuss the existing administrator proposal without turning a value objection into an inventory search.
  // Financial/project restrictions still apply; the dialogue layer repairs irrelevant or repetitive prose.
  if(isValueDiscussion(messages) && !(/anticipo\s*(?:de\s*)?(?:U\$S|USD)?\s*[\d.,]+/i.test(reply)&&/\d+\s*(?:pagos|cuotas)/i.test(reply)) && !salesReplyViolations(reply,recoleta).length && !asksKnownQualification(reply,memory))return reply;
  const available=project?.operatorKnowledge?.referenceUnits||[];
  const budget=salesBudgetLimits(memory.known.budget);
  const compatible=selectReferenceUnits(available.filter((u:any)=>fitsSalesBudget(u,budget)),JSON.stringify(memory.known));
  const mentionedUnit=reply.match(/\b(?:unidad|uf)\s*(\d{3,4})\b/i)?.[1];
  const asksAboutPrevious=/que piso.{0,30}(?:pasaste|mostraste|enviaste)/i.test(latest);
  const wrongUnit=!!mentionedUnit && !!available.length && !asksAboutPrevious && !compatible.some(u=>String(u.unit)===mentionedUnit);
  const mentionedFloor=reply.match(/\bpiso\s*(\d+)\b/i)?.[1];
  const wrongFloor=!!mentionedFloor && !!memory.known.floorPreference && !!available.length && !asksAboutPrevious && !compatible.some(u=>Number(u.floor)===Number(mentionedFloor));
  const repeatedProposal=memory.known.proposalRequested && /\?/.test(reply) && /(?:avanz|quier|gustaria|revis|envi).{0,50}propuesta/i.test(reply);
  const repeatedIntro=messages.filter(m=>m.direction==='outbound').slice(-3).some(m=>m.content.slice(0,100)===reply.slice(0,100));
  const wrongProject=memory.projectRequest.length===1 && /(?:nos centramos|te propongo|para tu busqueda|avancemos con|enfocamos|enfocamos en)/i.test(reply) && buildSalesMemory([{direction:'inbound',content:reply}]).projectRequest.some(name=>name!==memory.projectRequest[0]);
  if (salesReplyViolations(reply, recoleta).length || asksKnownQualification(reply, memory) || wrongProject || wrongUnit || wrongFloor || repeatedProposal || repeatedIntro) {
    reply = personalDisclosure ? (/herencia/i.test(latest) ? 'Gracias por contármelo. Podemos revisar con calma una opción acorde a lo que buscás. ¿Querés que avancemos con una propuesta concreta?' : 'Lamento lo que estás pasando. Podemos dejar la consulta en pausa y retomarla cuando prefieras.') : recoleta
      ? 'Feel Recoleta está en Pueyrredón y French, con unidades de 1, 2 y 3 ambientes. Se financia con anticipo y hasta 36 cuotas. ¿Avanzamos con una propuesta según tu búsqueda?'
      : project ? `Para ${String(project.name).trim()}, avancemos con una propuesta según tu consulta, verificando precio y disponibilidad con el equipo. ¿Querés que revisemos esa opción?`
      : 'Retomemos tu consulta y avancemos con una propuesta concreta. ¿Qué proyecto te interesa?';
  }
  if (!personalDisclosure && (salesReplyViolations(text,recoleta).length || asksKnownQualification(text,memory) || wrongProject || wrongUnit || wrongFloor || repeatedProposal || repeatedIntro) && compatible.length) {
    const u=compatible[0];
    const number=(value:number)=>Number(value).toLocaleString('es-AR',{maximumFractionDigits:2});
    const payment=u.monthlyPaymentReference ?? u.monthlyPayment;
    if(u.currency==='USD' && u.totalArea>0 && u.downPayment>0 && u.months>0 && payment>0 && (!recoleta || u.months<=36)) {
      const acknowledgement=/te pedi|no me gustan|piso alto/i.test(latest) ? 'Tomo tu preferencia de piso alto.\n' : '';
      const balcony=u.balconyArea ?? u.balconySemiCoveredArea;
      reply=`${acknowledgement}Unidad ${u.unit}: ${u.rooms===1?'Monoambiente':`${u.rooms} Ambientes`} de ${number(u.totalArea)}m2 Totales${balcony>0?`, con ${number(balcony)}m2 de Balcón`:''}, piso ${u.floor}.\nAnticipo U$S ${number(u.downPayment)} + ${u.months} pagos de U$S ${number(payment)}.\nDisponibilidad y condiciones a confirmar con el equipo.`;
      const priceList=project.operatorKnowledge.priceList||{};
      if(/CAC|pesific/i.test(priceList.payment||''))reply+=' Cuotas sujetas al ajuste indicado en la lista.';
      if(priceList.referenceOnly || priceList.currentValidityConfirmed===false)reply+=' Valores de referencia, vigencia a confirmar.';
    }
  }
  if (!personalDisclosure && available.length && !compatible.length && (wrongUnit || wrongFloor || repeatedProposal || repeatedIntro)) {
    reply=`No encuentro en la lista una unidad que cumpla ${[memory.known.apartment,memory.known.floorPreference].filter(Boolean).join(' y ')}. El equipo debe verificar una alternativa compatible antes de ofrecerte otra opción.`;
  }
  // Budget objections are actionable requests, never another invitation to re-offer a rejected unit.
  // Use every loaded list, while keeping rooms and floor requirements intact.
  if(!personalDisclosure && asksBudgetAlternative(latest) && budget.down) {
    const candidates=details.flatMap((p:any)=>(p.operatorKnowledge?.referenceUnits||[])
      .filter((u:any)=>u.sourceStatus==='LIBRE' && !(u.rooms===1 && /no (?:quiero|acepto).{0,25}(?:monoambiente|1 ambiente)/i.test(incoming)) && fitsSalesBudget(u,budget) && u.totalArea>0 && (p.slug!=='feel-recoleta'||u.months<=36))
      .map((u:any)=>({project:p,unit:u})));
    const matching=candidates.filter((c:any)=>selectReferenceUnits(c.project.operatorKnowledge.referenceUnits,JSON.stringify(memory.known)).some(u=>String(u.unit)===String(c.unit.unit)))
      .sort((a:any,b:any)=>Number(b.project.explicitlyMentioned)-Number(a.project.explicitlyMentioned)||a.unit.downPayment-b.unit.downPayment);
    const number=(n:number)=>Number(n).toLocaleString('es-AR',{maximumFractionDigits:2});
    if(matching.length) {
      const {project:p,unit:u}=matching[0];
      const balcony=u.balconyArea??u.balconySemiCoveredArea;
      reply=`Descartamos la opción anterior. En ${String(p.name).trim()}:\nUnidad ${u.unit}: ${u.rooms===1?'Monoambiente':`${u.rooms} Ambientes`} de ${number(u.totalArea)}m2 Totales${balcony>0?`, con ${number(balcony)}m2 de Balcón`:''}, piso ${u.floor}.\nAnticipo U$S ${number(u.downPayment)} + ${u.months} pagos de U$S ${number(u.monthlyPaymentReference??u.monthlyPayment)}.\nValores y disponibilidad a confirmar.`;
      if(/CAC|pesific/i.test(p.operatorKnowledge?.priceList?.payment||''))reply+=' Cuotas sujetas al ajuste de la lista.';
    } else if(candidates.length) {
      const smaller=candidates.filter((c:any)=>c.unit.rooms===1).sort((a:any,b:any)=>Number(b.project.explicitlyMentioned)-Number(a.project.explicitlyMentioned)||a.unit.downPayment-b.unit.downPayment)[0];
      if(smaller && /3\s*ambientes/i.test(memory.known.apartment||'') && !/no (?:quiero|acepto).{0,25}(?:monoambiente|1 ambiente)/i.test(incoming)) {
        const {project:p,unit:u}=smaller;
        const balcony=u.balconyArea??u.balconySemiCoveredArea;
        reply=`Como primer paso, en ${String(p.name).trim()}:\nUnidad Monoambiente de ${number(u.totalArea)}m2 Totales${balcony>0?`, con ${number(balcony)}m2 de Balcón`:''}, piso ${u.floor}.\nAnticipo U$S ${number(u.downPayment)} + ${u.months} pagos de U$S ${number(u.monthlyPaymentReference??u.monthlyPayment)}.\nAl finalizar, podrías revender para buscar una unidad mayor, según venta, saldos y costos. ¿Te sirve empezar con esta alternativa?\nValores y disponibilidad a confirmar.`;
        if(/CAC|pesific/i.test(p.operatorKnowledge?.priceList?.payment||''))reply+=' Cuotas ajustables según lista.';
      } else {
        const u=candidates.sort((a:any,b:any)=>a.unit.downPayment-b.unit.downPayment)[0];
        reply=`Descartamos esa unidad. Con tu anticipo de U$S ${number(budget.down)} encontré una alternativa en ${String(u.project.name).trim()}, pero no cumple ${[memory.known.apartment,memory.known.floorPreference].filter(Boolean).join(' y ')}. ¿Aceptarías revisar una opción de ${u.unit.rooms} ambiente${u.unit.rooms===1?'':'s'} en piso ${u.unit.floor}?`;
      }
    } else {
      const rows=details.flatMap((p:any)=>(p.operatorKnowledge?.referenceUnits||[]).filter((u:any)=>u.sourceStatus==='LIBRE'&&u.currency==='USD'&&u.downPayment>0).map((u:any)=>({p,u}))).sort((a:any,b:any)=>a.u.downPayment-b.u.downPayment);
      const closest=rows[0];
      reply=`Descartamos esa unidad. En las listas consultadas no encuentro una opción con anticipo de U$S ${number(budget.down)}.`;
      if(closest)reply+=` La más cercana es un ${closest.u.rooms===1?'monoambiente':`${closest.u.rooms} ambientes`} en ${String(closest.p.name).trim()}, con anticipo de U$S ${number(closest.u.downPayment)}${memory.known.apartment && !selectReferenceUnits([closest.u],JSON.stringify(memory.known)).length?`; no cumple tu búsqueda de ${memory.known.apartment}`:''}.`;
      reply+=' Hace falta verificar otra alternativa con el equipo.';
      if(messages.filter(m=>m.direction==='outbound').slice(-2).some(m=>/no encuentro una opci[oó]n con anticipo/.test(m.content)))reply=`Entiendo. Mantengo tu límite de U$S ${number(budget.down)}${memory.known.apartment?` y tu búsqueda de ${memory.known.apartment}`:''}${memory.known.floorPreference?`, ${memory.known.floorPreference}`:''}. Las listas cargadas no tienen una opción compatible. Para seguir, hace falta que un asesor verifique otros desarrollos dentro de ese rango.`;
    }
    // An unrelated brochure would distract from the actual affordability answer.
    return normalizeBrochureLinks(reply,details);
  }
  const optedOut = /no (?:me )?(?:escribas|contactes)|no quiero|dar(?:me)? de baja/i.test(latest);
  const url = project?.brochure_url && project?.slug ? `https://barrerabrokers.com/desarrollos/${encodeURIComponent(project.slug)}/brochure` : undefined;
  if (url && !optedOut && !personalDisclosure) {
    const alreadySent = messages.some((m,index) => m.direction === 'outbound' && (m.content.includes(url)||(m.attachment?.type==='document'&&/brochure|folleto/i.test(m.attachment.filename)&&buildSalesMemory(messages.slice(0,index),crm).projectRequest.includes(String(project.name).trim()))));
    if (!alreadySent || /brochure|folleto|pdf/i.test(latest)) {
      // Replace model-generated brochure URLs with the verified project route.
      reply = reply.replace(/https?:\/\/[^\s)]+/g, (link) => /brochure|drive\.google|storage\/v1/i.test(link) ? url : link);
      if (!reply.includes(url)) reply += `\n\nBrochure: ${url}`;
    }
  }
  return normalizeBrochureLinks(reply, details, project);
}
