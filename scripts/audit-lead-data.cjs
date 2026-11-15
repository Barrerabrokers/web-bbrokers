// Read-only by default. --apply re-reads and locks each lead, saves an exact backup,
// fills missing fields, and preserves the original attribution and commercial history.
const fs=require('node:fs');
const {load}=require('./lead-data-runtime.cjs');
const {whatsAppLeadPatch}=load('lib/whatsapp-lead-enrichment.ts');
const {splitInternationalPhone}=load('lib/phone-countries.ts');
const {extractWhatsAppForm}=load('lib/whatsapp-form-context.ts');
require('@next/env').loadEnvConfig(process.cwd());
const sql=require('postgres')(process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.DATABASE_URL,{ssl:'require',prepare:false,max:1,onnotice:()=>{},connect_timeout:10});
const missing=v=>!String(v||'').trim()||String(v).trim()==='-';
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
function recovered(lead,messages,developments){
 const patch={};let current={...lead,meta_properties:{...(lead.meta_properties||{})}};
 for(const m of messages){const p=whatsAppLeadPatch(current,m.content,m.id,String(m.created_at),m.phone||'');if(p){Object.assign(current,p);Object.assign(patch,p);}}
 const meta={...current.meta_properties},hub=lead.hubspot_properties||{};
 const value=(keys)=>keys.map(k=>meta['meta_field_'+k]||hub[k]).find(v=>!missing(v));
 const email=value(['email','work_email']);
 if(missing(current.email)&&email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))patch.email=String(email).toLowerCase().trim();
 const phone=value(['phone_number','phone','mobilephone']);
 if(missing(current.phone)&&phone&&String(phone).replace(/\D/g,'').length>=7){const p=splitInternationalPhone(String(phone),lead.country_code);patch.phone=p.phone;patch.country_code=p.countryCode;}
 const fullname=value(['full_name']);const first=value(['first_name','firstname']);const last=value(['last_name','lastname']);
 if(missing(current.first_name)){patch.first_name=first||String(fullname||'').split(/\s+/)[0]||current.first_name;}
 if(missing(current.last_name)){const result=last||String(fullname||'').split(/\s+/).slice(1).join(' ');if(result)patch.last_name=result;}
 const old=lead.development_name_text||'';
 if(!('crm_campaign_name' in meta)){
  const campaign=meta.meta_campaign_name || (/^campaña\s*:/i.test(old)?old.replace(/^campaña\s*:\s*/i,''):'');
  if(campaign)meta.crm_campaign_name=String(campaign).trim();
 }
 const dev=developments.find(d=>d.id===lead.development_id) || (!lead.development_id?developments.find(d=>norm(d.name)===norm(old)):null);
 if(dev){if(lead.development_id!==dev.id)patch.development_id=dev.id;if(old!==dev.name.trim())patch.development_name_text=dev.name.trim();}
 else if(/^(campaña\s*:|consulta de zona\s*:)/i.test(old)||['todos','usado','high ticket','palermo/recoleta','recoleta/palermo','belgrano/nunez','tres ambientes','san telmo','caballito','montserrat','monserrat'].includes(norm(old))){patch.development_name_text='';}
 if(patch.development_name_text!==undefined && old && patch.development_name_text!==old)meta.crm_legacy_development_text=meta.crm_legacy_development_text||old;
 // Preserve useful commercial answers from imported forms even if Meta never returned them.
 for(const [key,v] of Object.entries(hub))if(/^(cual.*presupuesto|cuando.*compra|como.*compra|te_interesa_invertir|te_estaremos_contactando)/.test(key)&&!missing(v)&&missing(meta['meta_field_'+key]))meta['meta_field_'+key]=v;
 if(JSON.stringify(meta)!==JSON.stringify(lead.meta_properties||{}))patch.meta_properties=meta;
 else delete patch.meta_properties;
 for(const k of Object.keys(patch))if(JSON.stringify(patch[k])===JSON.stringify(lead[k]))delete patch[k];
 return patch;
}
module.exports={recovered};
if(require.main===module)(async()=>{try{
 const leads=await sql`SELECT * FROM crm_leads ORDER BY id`;
 const developments=await sql`SELECT id,name FROM developments`;
 const messages=await sql`SELECT COALESCE(m.whatsapp_message_id,m.id::text) AS id,m.content,m.created_at,c.lead_id,c.phone FROM crm_whatsapp_messages m JOIN crm_whatsapp_conversations c ON c.id=m.conversation_id WHERE m.direction='inbound' AND c.lead_id IS NOT NULL
 UNION ALL SELECT COALESCE(a.external_id,a.id::text),a.body,COALESCE(a.scheduled_at,a.created_at),a.lead_id,'' FROM crm_activities a WHERE a.type='whatsapp' AND (a.external_source='whatsapp_inbound' OR a.title ~* '^(respuesta por whatsapp|whatsapp recibido)') ORDER BY created_at,id`;
 const byLead=new Map();for(const m of messages){if(!byLead.has(m.lead_id))byLead.set(m.lead_id,[]);byLead.get(m.lead_id).push(m);}
 const report={reviewed:leads.length,inboundMessages:messages.length,formMessages:messages.filter(m=>Object.keys(extractWhatsAppForm(m.content)).length).length,changed:0,fields:{},emailConflicts:[],remainingMissing:{},unresolvedDevelopments:[],changes:[]};
 const before=[];
 const candidates=process.argv.includes('--apply')?leads.filter(l=>Object.keys(recovered(l,byLead.get(l.id)||[],developments)).length):leads;
 console.error('Auditoría leída: '+leads.length+' leads. Candidatos: '+candidates.length);
 let processed=0;
 for(const lead of candidates){
   const apply=async(tx)=>{
    const current=tx?(await tx`SELECT * FROM crm_leads WHERE id=${lead.id} FOR UPDATE`)[0]:lead;
    const p=recovered(current,byLead.get(lead.id)||[],developments);
    if(p.email){const conflict=leads.find(l=>l.id!==lead.id&&norm(l.email)===norm(p.email));if(conflict){report.emailConflicts.push({id:lead.id,conflict:conflict.id,email:p.email});delete p.email;}}
    if(!Object.keys(p).length)return;
    before.push(current);report.changed++;for(const k of Object.keys(p))report.fields[k]=(report.fields[k]||0)+1;
    report.changes.push({id:lead.id,name:[lead.first_name,lead.last_name].join(' '),fields:Object.keys(p),development:p.development_name_text,campaign:p.meta_properties?.crm_campaign_name});
    if(tx){fs.appendFileSync('work/lead-recovery-before.jsonl',JSON.stringify(current)+'\n');await tx`UPDATE crm_leads SET ${tx(p,...Object.keys(p))},updated_at=NOW() WHERE id=${lead.id}`;}
   };
   if(process.argv.includes('--apply'))await sql.begin(apply);else await apply();
   if(++processed%100===0)console.error('Revisados '+processed+'/'+candidates.length);
 }
 const latest=process.argv.includes('--apply')?await sql`SELECT id,first_name,last_name,email,phone,development_id,development_name_text FROM crm_leads`:leads;
 report.remainingMissing={email:latest.filter(l=>missing(l.email)).length,phone:latest.filter(l=>missing(l.phone)).length,name:latest.filter(l=>missing(l.first_name)||/^(contacto|whatsapp)$/i.test(l.first_name)).length};
 report.unresolvedDevelopments=latest.filter(l=>!l.development_id&&l.development_name_text).map(l=>({id:l.id,value:l.development_name_text}));
 fs.writeFileSync('work/lead-data-audit-'+(process.argv.includes('--apply')?'applied':'preview')+'.json',JSON.stringify(report,null,2));
 const {changes,unresolvedDevelopments,...summary}=report;console.log(JSON.stringify({...summary,unresolvedDevelopments:unresolvedDevelopments.length}));
 }finally{await sql.end()}})().catch(e=>{console.error(e.code,e.message,e.detail||'');process.exitCode=1});
