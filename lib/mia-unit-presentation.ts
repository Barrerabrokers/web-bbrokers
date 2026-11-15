import { getSharedDatabase,releaseSharedDatabase } from '@/lib/database-pool';
import type { MiaUnit } from '@/lib/mia-sequence';
export type MiaUnitPresentation={project:string;unit:string;totalArea?:number;balconyArea?:number;deliveryMinMonths?:number;deliveryMaxMonths?:number;confirmedAt:string};
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export async function getMiaUnitPresentations():Promise<MiaUnitPresentation[]> {
  const sql=getSharedDatabase();try{const [row]=await sql`SELECT value FROM crm_whatsapp_agent_settings WHERE key='mia-unit-presentation-v1'`;const data=row?JSON.parse(row.value):[];return Array.isArray(data)?data:[];}finally{await releaseSharedDatabase(sql);}
}
export function applyMiaUnitPresentation(unit:MiaUnit,approved:MiaUnitPresentation[]):MiaUnit {
  const fact=approved.find(f=>normalize(f.project)===normalize(unit.project)&&normalize(f.unit)===normalize(unit.unit));
  if(!fact)return unit;
  const total=Number(fact.totalArea),balcony=Number(fact.balconyArea),min=Number(fact.deliveryMinMonths),max=Number(fact.deliveryMaxMonths);
  const presentation:MiaUnit['presentation']={};
  if(Number.isFinite(total)&&total>0)presentation.totalArea=total;
  if(Number.isFinite(balcony)&&balcony>=0&&presentation.totalArea&&balcony<=presentation.totalArea)presentation.balconyArea=balcony;
  const validDelivery=Number.isInteger(min)&&Number.isInteger(max)&&min>=0&&max>=min&&max<=120;
  if(validDelivery)presentation.deliveryMinMonths=min;
  return {...unit,presentation,deliveryMonths:validDelivery?max:unit.deliveryMonths};
}
