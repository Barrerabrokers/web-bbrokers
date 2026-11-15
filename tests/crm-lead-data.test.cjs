const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('../scripts/lead-data-runtime.cjs');
const form=load('lib/whatsapp-form-context.ts'),enrichment=load('lib/whatsapp-lead-enrichment.ts'),campaign=load('lib/crm-campaign.ts'),meta=load('lib/crm-meta-fields.ts');
const ponti=`¡Hola! Completé el formulario y me gustaría obtener más información sobre tu negocio.
¿Cual es tu presupuesto?:
Anticipo 40.000 y cuotas de
1800 (USD)
Que departamento te interesa?:
Tres Ambientes
¿Cuando querias avanzar con la compra?: 3-6 meses
Email: cliente@example.com
Te estaremos contactando pronto, confirmas tu interes?:
Si, respondere la llamada o mensaje
Full name: cliente ejemplo
Phone number:`;
test('captures screenshot fields without mixing budget, timeline, confirmation, phone or name',()=>{
 const f=form.extractWhatsAppForm(ponti);assert.equal(f.email,'cliente@example.com');assert.equal(f.name,'cliente ejemplo');assert.equal(f.budget,'Anticipo 40.000 y cuotas de 1800 (USD)');assert.equal(f.apartment,'Tres Ambientes');assert.equal(f.timeline,'3-6 meses');assert.equal(f.confirmation,'Si, respondere la llamada o mensaje');assert.equal(f.phone,undefined);
});
test('missing identity is recovered and all form answers are visible; sender phone fills empty form phone',()=>{
 const p=enrichment.whatsAppLeadPatch({first_name:'Contacto',last_name:'WhatsApp',email:null,phone:'',country_code:'+54',meta_properties:{crm_company_name:'Empresa'}},ponti,'msg1','2026-10-15T14:00:00Z','5491112345002');
 assert.equal(p.first_name,'cliente');assert.equal(p.last_name,'ejemplo');assert.equal(p.email,'cliente@example.com');assert.equal(p.country_code,'+54');assert.equal(p.phone,'91112345002');assert.equal(p.meta_properties.crm_company_name,'Empresa');
 const submissions=meta.getCrmMetaFormSubmissions(p.meta_properties);assert.equal(submissions.length,1);assert.ok(submissions[0].fields.some(f=>f.value==='3-6 meses'));
});
test('preserves valid identity and owner; duplicate delivery is idempotent',()=>{
 const l={first_name:'Cliente',last_name:'Ejemplo',email:'manual@example.com',phone:'1112345002',assigned_agent_id:'owner',meta_properties:{meta_campaign_name:'Inversores'}};
 const p=enrichment.whatsAppLeadPatch(l,ponti,'msg1','2026-10-15');assert.equal(p.email,undefined);assert.equal(p.first_name,undefined);assert.equal(p.phone,undefined);assert.equal(p.assigned_agent_id,undefined);
 const repeat=enrichment.whatsAppLeadPatch({...l,...p},ponti,'msg1','2026-10-15');assert.equal(JSON.parse(repeat.meta_properties.whatsapp_form_submissions).length,1);
});
test('Meta and WhatsApp submissions coexist, campaign is independent and can be cleared',()=>{
 const p=enrichment.whatsAppLeadPatch({meta_properties:{meta_submissions:JSON.stringify([{leadId:'meta1',fields:{presupuesto:'USD 60.000'}}])}},ponti,'msg1','2026-10-15');assert.equal(meta.getCrmMetaFormSubmissions(p.meta_properties).length,2);
 assert.equal(campaign.getCrmCampaign({meta_campaign_name:'Campaña inversores'}),'Campaña inversores');assert.equal(campaign.getCrmCampaign({meta_campaign_name:'Original',crm_campaign_name:''}),'');assert.equal(campaign.crmCampaignPatch(' Alpha ').crm_campaign_name,'Alpha');assert.deepEqual(campaign.crmCampaignPatch(),{});
});
test('referral ad text cannot supply form contact data',()=>{
 assert.deepEqual(form.extractWhatsAppForm('Hola\n[Origen del anuncio]\nEmail: ad@example.com'),{});
 assert.equal(enrichment.whatsAppLeadPatch({},'Hola','x','2026-10-15'),null);
});
test('campaign attribution accepts explicit ad ids and never substitutes headline or development',()=>{
 assert.deepEqual(enrichment.whatsAppAdReferral('Hola\n[Origen del anuncio]\n{"source_type":"ad","source_id":"12345","headline":"Campaña falsa"}'),{source_id:'12345'});
 assert.equal(enrichment.whatsAppAdReferral('Hola\n[Origen del anuncio]\n{"source_type":"post","source_id":"12345"}'),null);
 assert.equal(enrichment.whatsAppAdReferral('Hola'),null);
});
test('campaign and zone labels never become development options, historical developments remain valid',()=>{
 for(const name of ['Campaña: Campaña inversores','Campaña inversores','Consulta de zona: Recoleta','Todos','Belgrano/Núñez'])assert.equal(campaign.isCrmDevelopmentName(name),false,name);
 for(const name of ['Alpha Place Libertador','Obelisco','Cabrera'])assert.equal(campaign.isCrmDevelopmentName(name),true,name);
});
