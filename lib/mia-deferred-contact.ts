import { normalizeMiaSearch } from '@/lib/mia-agent-search';
type Message={direction:string;content:string;createdAt?:string};
/** Only customer turns can defer or resume contact. A sales offer cannot reset the wait. */
export function miaContactDeferred(messages:Message[]){
 let deferred=false;
 for(const m of messages.filter(m=>m.direction==='inbound')){
  const t=normalizeMiaSearch(m.content);
  if(/mas adelante|en unas semanas|en unos meses|ahora no es el momento/.test(t))deferred=true;
  else if(/(?:quiero|podemos|vamos a) (?:avanzar|agendar|coordinar|visitar) (?:ahora|hoy)|retomemos ahora/.test(t))deferred=false;
 }
 return deferred;
}
export function miaHumanCommercialText(text:string){
 return text.replace(/Pablo(?: Barrera)?/g,'un agente comercial');
}
