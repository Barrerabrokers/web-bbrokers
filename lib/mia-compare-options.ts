import { miaNeedBenefit } from '@/lib/mia-sales-principles';
import { loadMiaFinancingQuotes } from '@/lib/mia-entry-financing';
import { searchAgentQuotes,agentQuoteKey,type AgentMemory } from '@/lib/mia-agent-search';
import type { MiaOpportunity } from '@/lib/mia-opportunities';
import type { MiaVerifiedQuote } from '@/lib/whatsapp-mia-sources';
export async function miaCompareOptions(projects:MiaOpportunity[],memory:AgentMemory){
 const rows:{q:MiaVerifiedQuote;p:MiaOpportunity;text:string}[]=[];
 for(let i=0;i<projects.length;i+=4){await Promise.all(projects.slice(i,i+4).map(async p=>{const source=await loadMiaFinancingQuotes(p);for(const q of searchAgentQuotes(source.quotes,memory.preferences,[],memory.priority))if(q.down&&q.months&&q.installment&&q.currency==='USD')rows.push({q,p,text:source.text});}));}
 const sorted=searchAgentQuotes(rows.map(r=>r.q),memory.preferences,[],memory.priority);
 const ranked=sorted.sort((a,b)=>{const zone=(q:MiaVerifiedQuote)=>memory.preferences.neighborhoods.indexOf(rows.find(r=>r.q===q)!.p.neighborhood);return zone(a)-zone(b);});
 const chosen=ranked.slice(0,2).map(q=>rows.find(r=>r.q===q)!);
 const refs=chosen.map(({q})=>({key:agentQuoteKey(q),project:q.project,unit:q.unit}));
 if(!chosen.length)return {reply:'No encontré dos opciones con unidades y valores verificados que respeten tus filtros. ¿Qué preferís revisar con un agente comercial: el plazo o la financiación?',refs};
 const amount=(v:number)=>new Intl.NumberFormat('es-AR',{maximumFractionDigits:2}).format(v);
 const lines=chosen.map(({q,p,text},i)=>memory.salesNeeds?.focus&&memory.salesNeeds.focus!=='budget'?`${i?'B':'A'}) ${p.name} · ${q.unit} · ${p.neighborhood}; entrega ${p.delivery}, ${miaNeedBenefit(memory)}.`:`${i?'B':'A'}) ${p.name} · ${q.unit} · ${p.neighborhood}: anticipo USD ${amount(q.down!)} + ${q.months} cuotas de referencia USD ${amount(q.installment!)}${/pesificad|en pesos|a pesos/i.test(text)?', en pesos':''}${/\bCAC\b/i.test(text)?' + CAC':''}; entrega ${p.delivery}, ${miaNeedBenefit(memory)}.`);
 return {reply:lines.join('\n')+'\n'+(chosen.length===2?'¿Cuál se acerca más a lo que necesitás, A o B?':'¿Qué te gustaría revisar de esta opción?'),refs};
}
