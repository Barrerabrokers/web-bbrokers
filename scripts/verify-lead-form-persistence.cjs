const assert=require('node:assert/strict'),{load}=require('./lead-data-runtime.cjs');
const {persistLeadWhatsAppForm}=load('lib/whatsapp-lead-enrichment.ts');
require('@next/env').loadEnvConfig(process.cwd());
const sql=require('postgres')(process.env.DATABASE_URL,{ssl:'require',max:1,prepare:false,onnotice:()=>{}});
(async()=>{try{await sql.begin(async tx=>{
 await tx`SET LOCAL lock_timeout='5s'`;
 const [lead]=await tx`INSERT INTO crm_leads(id,first_name,last_name,email,phone,country_code,status,source,meta_properties) VALUES(gen_random_uuid(),'Contacto','WhatsApp',NULL,'','+54','Nuevo','Test',${tx.json({crm_campaign_name:'Campaña inversores',crm_company_name:'Conservar'})}) RETURNING id`;
 const content='Full name: Test Form\nEmail: persistence-test@example.invalid\nPresupuesto: Anticipo USD 40.000 y cuotas USD 1.800\nAmbientes: Tres ambientes\nPlazo de compra: 3-6 meses';
 for(let i=0;i<2;i++)await persistLeadWhatsAppForm(tx,lead.id,content,'test-message','2026-10-15T14:00:00Z','5491112345678');
 const [saved]=await tx`SELECT * FROM crm_leads WHERE id=${lead.id}`;
 assert.equal(saved.email,'persistence-test@example.invalid');assert.equal(saved.first_name,'Test');assert.equal(saved.last_name,'Form');assert.equal(saved.phone,'91112345678');assert.equal(saved.meta_properties.crm_campaign_name,'Campaña inversores');assert.equal(saved.meta_properties.crm_company_name,'Conservar');assert.equal(saved.development_id,null);assert.equal(JSON.parse(saved.meta_properties.whatsapp_form_submissions).length,1);
 const [other]=await tx`INSERT INTO crm_leads(id,first_name,last_name,email,phone,country_code,status) VALUES(gen_random_uuid(),'Contacto','WhatsApp',NULL,'','+54','Nuevo') RETURNING id`;
 await persistLeadWhatsAppForm(tx,other.id,content,'test-conflict','2026-10-15T14:00:00Z');
 const [conflict]=await tx`SELECT email,meta_properties FROM crm_leads WHERE id=${other.id}`;assert.equal(conflict.email,null);assert.equal(conflict.meta_properties.whatsapp_form_email_conflict,lead.id);assert.ok(conflict.meta_properties.whatsapp_form_submissions.includes('persistence-test@example.invalid'));
 throw new Error('VERIFIED_ROLLBACK');
 });}catch(e){if(e.message!=='VERIFIED_ROLLBACK')throw e;console.log('Persistencia, repetición de webhook, conservación de campaña y conflicto de email verificados con rollback.');}finally{await sql.end()}})().catch(e=>{console.error(e.code||e.message);process.exitCode=1});
