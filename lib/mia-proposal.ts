import type { MiaUnit } from '@/lib/mia-sequence';
const money=(value:number)=>new Intl.NumberFormat('es-AR',{minimumFractionDigits:Number.isInteger(value)?0:2,maximumFractionDigits:2}).format(value);
const number=(value:number)=>new Intl.NumberFormat('es-AR',{maximumFractionDigits:2}).format(value);
/** Financial facts remain server-rendered; source metadata stays in the CRM. */
export function renderMiaProposal(offers:MiaUnit[],requestedRooms?:number,alternativeRooms?:number) {
  const intro=alternativeRooms?`Para ampliar la búsqueda de ${requestedRooms===1?'1 ambiente':requestedRooms+' ambientes'}, te comparto una alternativa de ${alternativeRooms} ${alternativeRooms===1?'ambiente':'ambientes'} 😊`:offers.length===1?'Encontré una sola unidad que encaja con tu consulta. Te la comparto 😊':'Encontré dos opciones en el mismo desarrollo para que compares 😊';
  const blocks=offers.map((unit,index)=>{
    const area=unit.presentation?.totalArea!==undefined?`${number(unit.presentation.totalArea)} m² totales`:unit.area?.replace(/\s*\([^)]*\)/g,'').trim();
    const balcony=unit.presentation?.balconyArea?` (incluye ${number(unit.presentation.balconyArea)} m² de balcón)`:'';
    const delivery=unit.deliveryMonths===0?'inmediata':unit.presentation?.deliveryMinMonths!==undefined?`entre ${unit.presentation.deliveryMinMonths} y ${unit.deliveryMonths} meses`:`${unit.deliveryMonths} meses`;
    return [index===0?'La más económica compatible':'Alternativa de mayor precio',`${unit.project} · Unidad ${unit.unit} de ${unit.rooms} ${unit.rooms===1?'ambiente':'ambientes'}`,
      area?`Superficie: ${area}${balcony}`:'',
      unit.cash?`Contado: USD ${money(unit.price)}`:`Anticipo: USD ${money(unit.down!)} + ${unit.months} pagos de USD ${money(unit.installment!)}`,
      // A variable installment must never be represented as a fixed USD payment.
      unit.adjustment||'',
      unit.originalBudget&&unit.price>unit.originalBudget?`Supera tu presupuesto en USD ${money(unit.price-unit.originalBudget)} (${number((unit.price/unit.originalBudget-1)*100)} %).`:'',
      `Entrega: ${delivery}`,
      unit.website?`🌐 Conocé el desarrollo: ${unit.website}`:'',
      unit.planUrls?.[0]?`📎 Plano de la unidad ${unit.unit}: ${unit.planUrls[0]}`:''].filter(Boolean).join('\n');
  });
  return intro+'\n\n'+blocks.join('\n\n')+'\n\n'+(offers.length===1?'¿Te gusta esta opción o buscás una unidad más grande o en un piso más alto?':'¿Cuál te gusta más o qué cambiarías de estas opciones?');
}

/** Present one verified unit, keeping the remaining proposal for a later turn. */
export function renderMiaSingleOption(offers:MiaUnit[],index:number,requestedRooms?:number) {
  const unit=offers[index];
  const different=unit.rooms!==requestedRooms;
  const rendered=renderMiaProposal([unit],requestedRooms,different?unit.rooms:undefined);
  const intro=index>0?'Te comparto otra opción del mismo desarrollo 😊':offers.length>1?'Te comparto una primera opción 😊':undefined;
  let result=intro&&!different?rendered.replace(/^[^\n]+/,intro):rendered;
  if(index>0)result=result.replace('La más económica compatible','Alternativa de mayor precio');
  return result.replace('¿Te gusta esta opción o buscás una unidad más grande o en un piso más alto?','¿Cómo la ves para lo que buscás?');
}
