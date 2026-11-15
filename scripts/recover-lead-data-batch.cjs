const fs=require('node:fs'),{recovered}=require('./audit-lead-data.cjs');
const snapshot=JSON.parse(fs.readFileSync('work/lead-audit.json','utf8'));
const preview=JSON.parse(fs.readFileSync('work/lead-data-audit-preview.json','utf8'));
const ids=preview.changes.map(c=>c.id);
const {extractWhatsAppForm}=require('./lead-data-runtime.cjs').load('lib/whatsapp-form-context.ts');
require('@next/env').loadEnvConfig(process.cwd());
const sql=require('postgres')(process.env.DATABASE_URL,{ssl:'require',max:1,prepare:false,onnotice:()=>{}});
(async()=>{try{
 const messages=await sql`SELECT COALESCE(m.whatsapp_message_id,m.id::text) AS id,m.content,m.created_at,c.lead_id,c.phone FROM crm_whatsapp_messages m JOIN crm_whatsapp_conversations c ON c.id=m.conversation_id WHERE m.direction='inbound' AND c.lead_id IS NOT NULL
 UNION ALL SELECT COALESCE(a.external_id,a.id::text),a.body,COALESCE(a.scheduled_at,a.created_at),a.lead_id,'' FROM crm_activities a WHERE a.type='whatsapp' AND (a.external_source='whatsapp_inbound' OR a.title ~* '^(respuesta por whatsapp|whatsapp recibido)') ORDER BY created_at,id`;
 const byLead=new Map();for(const m of messages){if(!Object.keys(extractWhatsAppForm(m.content)).length)continue;if(!byLead.has(m.lead_id))byLead.set(m.lead_id,[]);byLead.get(m.lead_id).push(m);}
 const changes=[];
 for(let offset=0;offset<ids.length;offset+=100){
  await sql.begin(async tx=>{
   await tx`SET LOCAL lock_timeout='5s'`;
   const leads=await tx`SELECT * FROM crm_leads WHERE id IN ${tx(ids.slice(offset,offset+100))} ORDER BY id FOR UPDATE`;
   const updates=[];
   for(const lead of leads){
    const p=recovered(lead,byLead.get(lead.id)||[],snapshot.developments);
    if(p.email){const [conflict]=await tx`SELECT id FROM crm_leads WHERE lower(btrim(email))=${p.email} AND id<>${lead.id} LIMIT 1`;if(conflict){delete p.email;p.meta_properties={...(p.meta_properties||lead.meta_properties),whatsapp_form_email_conflict:conflict.id};}}
    if(!Object.keys(p).length)continue;
    fs.appendFileSync('work/lead-recovery-batch-before.jsonl',JSON.stringify(lead)+'\n');
    updates.push({id:lead.id,...p});changes.push({id:lead.id,fields:Object.keys(p)});
   }
   if(updates.length)await tx.unsafe(`UPDATE crm_leads l SET
     meta_properties=CASE WHEN p ? 'meta_properties' THEN p->'meta_properties' ELSE l.meta_properties END,
     development_id=CASE WHEN p ? 'development_id' THEN (p->>'development_id')::uuid ELSE l.development_id END,
     development_name_text=CASE WHEN p ? 'development_name_text' THEN p->>'development_name_text' ELSE l.development_name_text END,
     first_name=CASE WHEN p ? 'first_name' THEN p->>'first_name' ELSE l.first_name END,
     last_name=CASE WHEN p ? 'last_name' THEN p->>'last_name' ELSE l.last_name END,
     email=CASE WHEN p ? 'email' THEN p->>'email' ELSE l.email END,
     country_code=CASE WHEN p ? 'country_code' THEN p->>'country_code' ELSE l.country_code END,
     phone=CASE WHEN p ? 'phone' THEN p->>'phone' ELSE l.phone END,
     updated_at=NOW()
     FROM jsonb_array_elements($1::jsonb) p WHERE l.id=(p->>'id')::uuid`,[tx.json(updates)]);
  });
  console.log('Lote verificado '+Math.min(offset+100,ids.length)+'/'+ids.length);
 }
 fs.writeFileSync('work/lead-recovery-batch-changes.json',JSON.stringify(changes));console.log(JSON.stringify({changed:changes.length}));
 }finally{await sql.end()}})().catch(e=>{console.error(e.code,e.message,e.detail||'');process.exitCode=1});
