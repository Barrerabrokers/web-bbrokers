import {z} from 'zod';
import {CRM_LEAD_STATUS_VALUES,leadStatusFilterValues} from './crm-statuses';
export const exportFiltersSchema=z.object({
 statuses:z.array(z.string().refine(v=>CRM_LEAD_STATUS_VALUES.includes(v as any))).max(30).default([]),
 developments:z.array(z.string().min(1).max(500)).max(100).default([]),
 owners:z.array(z.string().uuid().or(z.literal('unassigned'))).max(100).default([]),
 campaigns:z.array(z.string().max(500)).max(100).default([]),
 from:z.string().default(''),to:z.string().default(''),
}).superRefine((v,ctx)=>{for(const k of ['from','to'] as const){if(v[k]&&(!/^\d{4}-\d{2}-\d{2}$/.test(v[k])||!Number.isFinite(Date.parse(v[k]))||new Date(v[k]).toISOString().slice(0,10)!==v[k]))ctx.addIssue({code:'custom',message:'Fecha inválida',path:[k]});}if(v.from&&v.to&&v.from>v.to)ctx.addIssue({code:'custom',message:'La fecha desde debe ser anterior a hasta'});});
export type ExportFilters=z.infer<typeof exportFiltersSchema>;
export const campaignExpression="btrim(COALESCE(l.meta_properties->>'crm_campaign_name',l.meta_properties->>'whatsapp_referral_campaign_name',l.meta_properties->>'meta_campaign_name',''))";
export const developmentExpression="btrim(COALESCE(NULLIF(d.name,''),l.development_name_text,''))";
export function exportWhere(f:ExportFilters,userId:string,all:boolean){
 const values:string[]=[],clauses:string[]=[];const arg=(v:string)=>{values.push(v);return '$'+values.length;};
 if(!all)clauses.push(`l.assigned_agent_id=${arg(userId)}::uuid`);
 if(f.owners.length){const ids=f.owners.filter(x=>x!=='unassigned').map(x=>arg(x)+'::uuid');const parts=[...(ids.length?[`l.assigned_agent_id IN (${ids.join(',')})`]:[]),...(f.owners.includes('unassigned')?['l.assigned_agent_id IS NULL']:[])];clauses.push('('+parts.join(' OR ')+')');}
 if(f.statuses.length)clauses.push(`lower(btrim(l.status)) IN (${[...new Set(f.statuses.flatMap(leadStatusFilterValues))].map(arg).join(',')})`);
 if(f.developments.length)clauses.push(`${developmentExpression} IN (${f.developments.map(arg).join(',')})`);
 if(f.campaigns.length)clauses.push(`${campaignExpression} IN (${f.campaigns.map(arg).join(',')})`);
 if(f.from)clauses.push(`l.created_at >= (${arg(f.from)}::date::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')`);
 if(f.to)clauses.push(`l.created_at < ((${arg(f.to)}::date + 1)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')`);
 return {where:clauses.length?'WHERE '+clauses.join(' AND '):'',values};
}
export function exportPhone(phone:string|null,country:string|null){
 const raw=(phone||'').trim();if(!raw)return '';const digits=raw.replace(/\D/g,'');if(!digits)return raw;
 if(raw.startsWith('+'))return '+'+digits;if(raw.startsWith('00'))return '+'+digits.slice(2);
 const code=(country||'').replace(/\D/g,'');if(!code)return digits;
 // Existing international numbers must not receive the country code twice.
 if(digits.startsWith(code)&&digits.length>10)return '+'+digits;
 const national=code==='54'?digits.replace(/^0/,''):digits;
 return '+'+code+national;
}
