import { readSource, verifiedSheetQuotes, sourceValidity, type MiaVerifiedQuote } from '@/lib/whatsapp-mia-sources';
import { extractVerifiedPaymentRows } from '@/lib/whatsapp-sales-offers';
import { isMiaSourceUrl } from '@/lib/whatsapp-mia-sources-config';
import type { MiaOpportunity } from '@/lib/mia-opportunities';

export function renderMiaEntryFinancing(project:string,quotes:MiaVerifiedQuote[],sourceText:string){
 const plans=quotes.filter(q=>q.project===project&&q.currency==='USD'&&q.down&&q.installment&&q.months&&Number.isInteger(q.months)&&q.months>0).sort((a,b)=>a.down!-b.down!||a.price-b.price);
 const q=plans[0];
 if(!q)return `${project}: necesito confirmar el anticipo y el importe de las cuotas con la lista vigente antes de pasártelos.`;
 const money=(n:number)=>new Intl.NumberFormat('es-AR',{maximumFractionDigits:2}).format(n);
 const pesos=/pesificad|en pesos|a pesos/i.test(sourceText),cac=/\bCAC\b/i.test(sourceText);
 const plan=`${project}: desde un anticipo de USD ${money(q.down!)} + ${q.months} cuotas de USD ${money(q.installment!)}${pesos?' de referencia, pagaderas en pesos':''}${cac?' con ajuste CAC':''}.`;
 return plan;
}
export async function loadMiaFinancingQuotes(p:MiaOpportunity):Promise<{quotes:MiaVerifiedQuote[];text:string}>{
 if(!p.priceList||!isMiaSourceUrl(p.priceList))return {quotes:[],text:''};
 try{
  const doc=await readSource(p.priceList);if(!sourceValidity(doc.text))return {quotes:[],text:''};
  const quotes:MiaVerifiedQuote[]=doc.rows.length?verifiedSheetQuotes(doc,p.name):extractVerifiedPaymentRows(doc.text).map((r,i)=>({token:'',project:p.name,unit:r.unit,rooms:r.rooms,price:r.price,currency:'USD',down:r.downPayment,months:r.months,installment:r.monthlyPayment,source:doc.url,row:i,readAt:new Date().toISOString()}));
  return {quotes,text:doc.text};
 }catch{return {quotes:[],text:''};}
}
export async function miaEntryFinancing(p:MiaOpportunity,unit?:string){
 const result=await loadMiaFinancingQuotes(p);
 return renderMiaEntryFinancing(p.name,unit?result.quotes.filter(q=>q.unit===unit):result.quotes,result.text);
}
