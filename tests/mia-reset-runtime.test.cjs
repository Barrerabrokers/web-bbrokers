const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:id=>mocks[id]||(id.startsWith('@/')?load(id.replace('@/','')+'.ts',mocks):require(id)),console,Date,process});return module.exports;}
const now=Date.now(),resetAt=new Date(now-60000).toISOString();
const incoming=(content='Hola')=>({direction:'inbound',content,status:'sent',createdAt:new Date(now).toISOString()});
const outbound={direction:'outbound',content:'Mensaje enviado',status:'sent',createdAt:new Date(now-1000).toISOString()};
function harness(options={}){
 const calls={models:0,context:0,guidance:0};
 const config={resetAt,audience:options.public?'all':'private',activatedAt:options.activatedAt||new Date(now-2000).toISOString(),testConversationId:'pablo-chat',testAdministratorId:'pablo-admin'};
 const sql=async(strings)=>strings.join('').includes('FROM agents')?(options.admin===false?[]:[{id:'pablo-admin'}]):[{value:JSON.stringify(config)}];
 const api=load('lib/mia-reset-runtime.ts',{
  './mia-sales-assignment':{assignedMiaSalesConversationContext:async()=>options.crmContext},
  '@/lib/mia-meetings':{replyMiaMeeting:async()=>options.meeting?{reply:'Estos son los horarios disponibles'}:null},
  '@/lib/database-pool':{getSharedDatabase:()=>sql,releaseSharedDatabase:async()=>{}},
  '@/lib/mia-project-trial':{getMiaTrialConfig:async()=>({enabled:!!options.trial,startedAt:options.startedAt}),generateMiaProjectTrial:async(history,config,style,agentOptions)=>{calls.trial=history;calls.crmContext=agentOptions?.crmContext;return 'Prueba conversacional de tres proyectos';}},
  '@/lib/mia-guidance':{getMiaGuidance:async()=>{calls.guidance++;return {instructions:options.instructions||'',corrections:options.corrections||[]};}},
  '@/lib/whatsapp-ai-provider':{generateGroqCustomerReply:async(prompt,input)=>{calls.models++;calls.prompt=prompt;calls.input=input;return 'Respuesta de prueba aprobada';}}
 });
 return {calls,reply:(id,messages)=>api.generateMiaResetReply(id,messages,async()=>{calls.context++;return {nombre:'Carolina Chiaradia'};})};
}
test('a real lead receives the exact named welcome without a model or old guidance',async()=>{
 const h=harness({instructions:'Regla que solo se usa en pruebas'});
 assert.equal(await h.reply('lead-chat',[incoming()]),'Hola, Carolina, ¿cómo estás? ¡Qué bueno que te contactaste por nuestros desarrollos! En breve, un agente se va a estar contactando para ofrecerte opciones de unidades. Saludos.');
 assert.equal(h.calls.models,0);assert.equal(h.calls.guidance,0);
});
test('later enquiries, menus and sales requests from real leads remain silent',async()=>{
 for(const text of ['1','2','Busco 2 ambientes','Reservar','Nueva búsqueda','Sí']){
  const h=harness({instructions:'Responder ofertas'});
  assert.equal(await h.reply('lead-chat',[outbound,incoming(text)]),null);
  assert.equal(h.calls.models,0);assert.equal(h.calls.guidance,0);
 }
});
test('a new release ignores old sales responses but not its own welcome',async()=>{
 const h=harness();const old={...outbound,createdAt:new Date(now-120000).toISOString()};
 assert.match(await h.reply('lead-chat',[old,incoming()]),/^Hola, Carolina/);
 assert.equal(await h.reply('lead-chat',[old,outbound,incoming()]),null);
});
test('old inbound, opt-out, cleared and historical messages do not trigger replies',async()=>{
 const h=harness();for(const messages of [[{...incoming(),createdAt:'2020-01-01'}],[incoming('No me escriban')],[{...incoming(),status:'historical'}],[{...incoming(),status:'cleared'}],[outbound]])assert.equal(await h.reply('lead-chat',messages),null);
});
test('only the verified Pablo test chat can use newly approved rules',async()=>{
 const h=harness({instructions:'Ofrecer visita únicamente cuando lo pidan.'});
 assert.equal(await h.reply('pablo-chat',[outbound,incoming('Prueba')]),'Respuesta de prueba aprobada');
 assert.equal(h.calls.models,1);assert.match(h.calls.prompt,/Ofrecer visita únicamente/);
 const impostor=harness({admin:false,instructions:'Regla de prueba'});
 assert.equal(await impostor.reply('pablo-chat',[outbound,incoming()]),null);assert.equal(impostor.calls.models,0);
});
test('blank sandbox has no inherited commercial process or provider call',async()=>{
 const h=harness();assert.match(await h.reply('pablo-chat',[outbound,incoming()]),/Todavía no hay respuestas programadas/);assert.equal(h.calls.models,0);
});
test('test history starts at the reset and never includes earlier sales facts',async()=>{
 const h=harness({instructions:'Regla nueva'});
 await h.reply('pablo-chat',[{...incoming('Dato viejo'),createdAt:'2020-01-01'},outbound,incoming('Dato nuevo')]);
 assert(!JSON.stringify(h.calls.input).includes('Dato viejo'));
});
test('real sending has an independent database gate against a repeated welcome',()=>{
 const code=fs.readFileSync('lib/whatsapp-turn-lock.ts','utf8');
 assert.equal((code.match(/NOT EXISTS\(SELECT 1 FROM crm_whatsapp_messages sent/g)||[]).length,2);
 const generator=fs.readFileSync('lib/whatsapp-inbox.ts','utf8').split('export async function generateWhatsAppAiReply')[1];
 assert.match(generator,/generateMiaResetReply/);assert.doesNotMatch(generator,/prepareMiaSequenceReply|generateMiaConversation/);
});

test('the three-project trial is available only to the verified administrator, from its own start date',async()=>{
 const startedAt=new Date(now-500).toISOString();const h=harness({trial:true,startedAt});
 assert.equal(await h.reply('pablo-chat',[outbound,incoming('Feel Palermo')]),'Prueba conversacional de tres proyectos');
 assert.equal(h.calls.trial.length,1);assert.equal(h.calls.trial[0].content,'Feel Palermo');
 const real=harness({trial:true});assert.equal(await real.reply('other-lead',[outbound,incoming()]),null);assert.equal(real.calls.trial,undefined);
 const invalid=harness({trial:true,admin:false});assert.equal(await invalid.reply('pablo-chat',[outbound,incoming()]),null);assert.equal(invalid.calls.trial,undefined);
});

test('public activation uses the verified project assistant for new turns from any lead and retains their dialogue',async()=>{
 const h=harness({public:true,trial:true});
 assert.equal(await h.reply('other-lead',[outbound,incoming('Busco 2 ambientes')]),'Prueba conversacional de tres proyectos');
 assert.equal(h.calls.trial.length,2);assert.equal(h.calls.models,0);
});
test('public activation cannot send to old pending enquiries or use the old agent when project sources are disabled',async()=>{
 const old=harness({public:true,trial:true,activatedAt:new Date(now+500).toISOString()});assert.equal(await old.reply('lead',[incoming()]),null);assert.equal(old.calls.trial,undefined);
 const disabled=harness({public:true,trial:false,instructions:'Datos viejos'});assert.equal(await disabled.reply('lead',[incoming()]),null);assert.equal(disabled.calls.models,0);
});
test('public handoff acknowledges an explicit adviser request without asking the model or treating 1 as a handoff',async()=>{
 const h=harness({public:true,trial:true});assert.match(await h.reply('lead',[incoming('Quiero hablar con un asesor')]),/agente de Barrera/);assert.equal(h.calls.trial,undefined);
 const numeric=harness({public:true,trial:true});await numeric.reply('lead',[incoming('1')]);assert(numeric.calls.trial);
});

test('both send claims require a new inbound after public activation and preserve per-chat pauses',()=>{
 const code=fs.readFileSync('lib/whatsapp-turn-lock.ts','utf8');
 assert.equal((code.match(/runtime.value::jsonb->>'audience'='all'/g)||[]).length,2);
 assert.equal((code.match(/runtime.value::jsonb->>'activatedAt'/g)||[]).length,2);
 assert.match(code,/AND c.ai_enabled AND c.status='open' AND c.channel='instagram'/);
 assert.match(code,/AND \(c.ai_enabled OR/);
});
test('accepting the immediately preceding human-handoff question acknowledges the handoff instead of looping',async()=>{
 const h=harness({public:true,trial:true});
 const question={...outbound,content:'No encuentro una opción compatible. ¿Querés que un agente revise alternativas para vos?'};
 assert.match(await h.reply('lead-chat',[question,incoming('Sí, gracias')]),/un agente.*continuar/);
 assert.equal(h.calls.trial,undefined);
 const notHandoff=harness({public:true,trial:true});
 assert.equal(await notHandoff.reply('lead-chat',[{...outbound,content:'¿Querés ver la lista de precios?'},incoming('Sí')]),'Prueba conversacional de tres proyectos');
 assert(notHandoff.calls.trial);
});
test('handoff acceptance does not treat a qualified yes or a refusal as consent',()=>{
 const api=load('lib/mia-reset-runtime.ts',{
  './mia-sales-assignment':{assignedMiaSalesConversationContext:async()=>options.crmContext},'@/lib/mia-meetings':{},'@/lib/database-pool':{},'@/lib/mia-project-trial':{},'@/lib/mia-guidance':{},'@/lib/whatsapp-ai-provider':{}});
 const q='¿Querés que un agente revise alternativas para vos?';
 assert(api.miaHumanHandoffRequested('Sí',q));assert(api.miaHumanHandoffRequested('Dale, gracias',q));
 assert(!api.miaHumanHandoffRequested('No',q));assert(!api.miaHumanHandoffRequested('Sí, pero antes mostrame otras opciones',q));
 assert(!api.miaHumanHandoffRequested('Sí','¿Querés conocer el proyecto?'));
});
test('accepted handoff pauses only after delivery and a fresh check of the customer and prior question',async()=>{
 for(const accepted of [true,false]){
  let updates=0;
  const sql=async(strings)=>{const query=strings.join('');if(query.includes('SELECT incoming.content'))return [{customer_text:accepted?'Sí':'Otra cosa',previous_reply:'¿Querés que un agente revise alternativas?'}];if(query.includes('UPDATE'))updates++;return [];};
  const api=load('lib/mia-reset-runtime.ts',{
  './mia-sales-assignment':{assignedMiaSalesConversationContext:async()=>options.crmContext},'@/lib/mia-meetings':{},'@/lib/database-pool':{getSharedDatabase:()=>sql,releaseSharedDatabase:async()=>{}},'@/lib/mia-project-trial':{},'@/lib/mia-guidance':{},'@/lib/whatsapp-ai-provider':{}});
  await api.finishMiaPublicHandoff('lead-chat','Sí');assert.equal(updates,accepted?1:0);
 }
});
test('declining a human handoff keeps the conversation open without repeating the handoff question',async()=>{
 const h=harness({public:true,trial:true});
 const question={...outbound,content:'No encuentro una opción compatible. ¿Querés que un agente revise alternativas para vos?'};
 assert.equal(await h.reply('lead-chat',[question,incoming('No, gracias')]),'Entendido, seguimos por acá. ¿Qué te gustaría ajustar de la búsqueda?');
 assert.equal(h.calls.trial,undefined);
});

test('accepting a meeting after reservation conditions does not pause the AI as a human handoff',async()=>{
 const h=harness({public:true,trial:true,meeting:true});
 const question={...outbound,content:'El equipo debe confirmar disponibilidad y condiciones. ¿Querés coordinar una reunión con Pablo para revisarla?'};
 assert.equal(await h.reply('lead',[question,incoming('Sí')]),'Estos son los horarios disponibles');
});

test('assigned MIA sales context reaches the public assistant without leaking into the sandbox',async()=>{const h=harness({public:true,trial:true,crmContext:'CRM: pidió dos ambientes'});await h.reply('lead-chat',[incoming()]);assert.equal(h.calls.crmContext,'CRM: pidió dos ambientes');const privateH=harness({trial:true,crmContext:'CRM: privado'});await privateH.reply('pablo-chat',[incoming()]);assert.equal(privateH.calls.crmContext,undefined);});
