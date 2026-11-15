const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:id=>mocks[id]||(id.startsWith('@/')?load(id.slice(2)+'.ts',mocks):require(id)),console,Date,process,Set,Map});return module.exports;}
const search=load('lib/mia-agent-search.ts');
const project={name:'Alpha Place Libertador',slug:'alpha-place-libertador',neighborhood:'Núñez',status:'en_construccion'};
const preferences=search.agentPreferencesSchema.parse({rooms:[2],neighborhoods:['Núñez'],down:{amount:50000,currency:'USD'},monthly:{amount:2000,currency:'USD'},financing:true});
const quote=(i,extra={})=>({project:project.name,unit:String(i),rooms:2,currency:'USD',price:100000,down:40000,months:30,installment:2000,token:`[[MIA_COTIZACION:${i.toString(16)}]]`,...extra});
test('complete inventory is filtered before paging: the matching row may be beyond the first five',()=>{
 const rows=Array.from({length:18},(_,i)=>quote(i,{rooms:1}));rows.push(quote(99));
 assert.equal(search.searchAgentQuotes(rows,preferences)[0].unit,'99');
});
test('total price, down payment and monthly budget are separate strict limits, with no currency conversion',()=>{
 const rows=[quote(1),quote(2,{down:60000}),quote(3,{installment:2100}),quote(4,{currency:'ARS'}),quote(5,{down:undefined}),quote(6,{rooms:1})];
 assert.deepEqual(Array.from(search.searchAgentQuotes(rows,preferences),q=>q.unit),['1']);
 assert.equal(search.searchAgentQuotes(rows,{...preferences,total:{amount:90000,currency:'USD'}}).length,0);
 assert.equal(preferences.total,null);
});
test('immediate delivery never silently substitutes a construction project or neighboring area',()=>{
 const catalog=[project,{name:'Finished',slug:'finished',neighborhood:'Belgrano',status:'finalizado'}];
 assert.equal(search.selectAgentProjects(catalog,{...preferences,delivery:'immediate'}).length,0);
 assert.equal(search.selectAgentProjects(catalog,preferences)[0].slug,project.slug);
});
test('another option excludes delivered unit identities even if current prices/tokens changed',()=>{
 const q=quote(1);assert.equal(search.searchAgentQuotes([q,quote(2)],preferences,[search.agentQuoteKey(q)])[0].unit,'2');
});
test('planner rejects unknown projects and malformed budgets rather than widening a search',()=>{
 const plan={intent:'search',reset:false,more:false,selected:null,unclearBudget:false,preferences};
 assert.throws(()=>search.validateAgentPlan(JSON.stringify({...plan,preferences:{...preferences,projects:['Invented']}}),[project]));
 assert.throws(()=>search.validateAgentPlan(JSON.stringify({...plan,preferences:{...preferences,down:{amount:50000}}}),[project]));
 assert.equal(search.validateAgentPlan(JSON.stringify(plan),[project]).preferences.rooms[0],2);
});
function harness(plans,rows,initial){
 const calls={prompts:[],writes:[],sources:0};
 let step=0;
 const api=load('lib/mia-agent.ts',{
  '@/lib/mia-agent-search':search,
  '@/lib/whatsapp-ai-provider':{generateGroqCustomerReply:async(prompt)=>{calls.prompts.push(prompt);return JSON.stringify(step++%2===0?plans[Math.floor((step-1)/2)]:{reply:rows.map(q=>q.token).slice(0,2).join('\n'),evidence:[]});}},
  '@/lib/whatsapp-sales-catalog':{salesDocumentExcerpt:s=>s},
  '@/lib/mia-agent-memory':{readAgentMemory:async()=>initial||search.emptyAgentMemory(),writeAgentMemory:async(...args)=>calls.writes.push(args)},
  '@/lib/mia-project-trial':{MIA_TRIAL_POLICY:'Policy',loadMiaPublicCatalog:async()=>[project],loadMiaTrialContext:async()=>{calls.sources++;return {documents:[{id:'web:'+project.slug,project:project.name,text:'Publicado',kind:'website'}],links:[project],issues:[],quotes:rows};},renderMiaTrialReply:(raw,c)=>{const reply=JSON.parse(raw).reply;for(const token of reply.match(/\[\[MIA_COTIZACION:[a-f0-9]+\]\]/g)||[])if(!c.quotes.some(q=>q.token===token))throw Error('Unmatched quote');return reply;}},
 });return {api,calls};
}
test('semantic plan carries corrections and distinct budgets into the answer and durable memory',async()=>{
 const plan={intent:'search',reset:false,more:false,selected:null,unclearBudget:false,preferences};
 const h=harness([plan],[quote(1)]);
 const result=await h.api.runMiaAgent([{id:'inbound-2',direction:'inbound',content:'No, dos ambientes; el anticipo es 50 mil dólares y la cuota hasta 2000 dólares'}],{enabled:true},'',{conversationId:'chat',scope:'reset'});
 assert.equal(result.memory.preferences.rooms[0],2);assert.equal(result.memory.preferences.total,null);assert.equal(h.calls.writes.length,1);
 assert.equal(h.calls.writes[0][2],'inbound-2');assert.match(h.calls.prompts[1],/matchingCount/);
});
test('unknown currency asks one clarification before reading source lists or offering units',async()=>{
 const plan={intent:'search',reset:false,more:false,selected:null,unclearBudget:true,preferences:search.agentPreferencesSchema.parse({})};
 const h=harness([plan],[quote(1)]);
 const result=await h.api.runMiaAgent([{direction:'inbound',content:'Tengo 50000 para anticipo'}],{enabled:true});
 assert.match(result.reply,/dólares o en pesos/);assert.equal(h.calls.sources,0);assert.equal(h.calls.writes.length,0);
});
test('out-of-date inbound turns cannot overwrite memory for a newer turn',async()=>{
 const writes=[];const tx=async(strings,...args)=>{const sql=strings.join('');if(sql.includes('SELECT m.id'))return [{id:'newer-inbound'}];if(sql.includes('INSERT'))writes.push(args);return [];};
 const sql={begin:async fn=>fn(tx)};
 const api=load('lib/mia-agent-memory.ts',{'@/lib/mia-agent-search':search,'@/lib/database-pool':{getSharedDatabase:()=>sql,releaseSharedDatabase:async()=>{}}});
 await api.writeAgentMemory('chat','reset','old-inbound',search.emptyAgentMemory());assert.equal(writes.length,0);
});
test('simulator memory is ephemeral and the runtime is the only caller supplying a real conversation ID',()=>{
 const route=fs.readFileSync('app/api/crm/whatsapp/mia-test/route.ts','utf8');
 assert.match(route,/memory:parsed.data.agentMemory/);assert.doesNotMatch(route,/writeAgentMemory|conversationId:/);
 assert.match(fs.readFileSync('lib/mia-reset-runtime.ts','utf8'),/generateMiaProjectTrial\(dialogue, trial, style,\{conversationId,crmContext,persistProfile:!sandbox,scope:/);
});
test('first and second references preserve actual token order, without prefix collisions between unit numbers',()=>{
 const first=quote(1),second=quote(10);
 const offered=search.agentOfferedQuotes(second.token+'\n'+first.token,[first,second]);
 assert.deepEqual(Array.from(offered,q=>q.unit),['10','1']);
 const headings=search.agentDeliveredHeadings([{direction:'outbound',content:'Alpha Place Libertador · Unidad 10\nPrecio de lista: USD 100000'}]);
 assert(headings.has('Alpha Place Libertador · Unidad 10'));assert(!headings.has('Alpha Place Libertador · Unidad 1'));
});
test('a compatible verified unit is still offered when the drafting model omits the quote',async()=>{
 const plan={intent:'search',reset:false,more:false,selected:null,unclearBudget:false,preferences};
 let count=0;const q=quote(42);
 const api=load('lib/mia-agent.ts',{
  '@/lib/mia-agent-search':search,
  '@/lib/whatsapp-ai-provider':{generateGroqCustomerReply:async()=>JSON.stringify(count++===0?plan:{reply:'Podemos explorar alternativas para acercarnos a lo que buscás.',evidence:[]})},
  '@/lib/whatsapp-sales-catalog':{salesDocumentExcerpt:s=>s},
  '@/lib/mia-agent-memory':{},
  '@/lib/mia-project-trial':{MIA_TRIAL_POLICY:'Policy',loadMiaPublicCatalog:async()=>[project],loadMiaTrialContext:async()=>({documents:[{id:'web:'+project.slug,project:project.name,text:'Publicado',kind:'website'}],links:[project],issues:[],quotes:[q]}),renderMiaTrialReply:raw=>JSON.parse(raw).reply},
 });
 const result=await api.runMiaAgent([{direction:'inbound',content:'Mostrame opciones'}],{enabled:true});
 assert.match(result.reply,/MIA_COTIZACION/);assert.equal(result.memory.lastOffered[0].unit,'42');assert.doesNotMatch(result.reply,/explorar alternativas/);
});
test('explicit rooms are reconciled against the customer text even if a fallback model confuses bedrooms with rooms',()=>{
 const bad={preferences:{...preferences,rooms:[3]},intent:'search',reset:false,more:false,selected:null,unclearBudget:false};
 assert.deepEqual(Array.from(search.reconcileAgentRoomCount(bad,'Busco dos ambientes en Núñez.').preferences.rooms),[2]);
 assert.deepEqual(Array.from(search.reconcileAgentRoomCount(bad,'No, un ambiente.').preferences.rooms),[1]);
 assert.deepEqual(Array.from(search.reconcileAgentRoomCount(bad,'Dos dormitorios').preferences.rooms),[3]);
 assert.deepEqual(Array.from(search.reconcileAgentRoomCount(bad,'Me sirven uno o dos ambientes').preferences.rooms),[1,2]);
 assert.deepEqual(Array.from(search.reconcileAgentRoomCount(bad,'Hasta dos ambientes').preferences.rooms),[1,2]);
 assert.deepEqual(Array.from(search.reconcileAgentRoomCount(bad,'No busco dos ambientes').preferences.rooms),[3]);
});
test('personal proposals honor explicit payment or space priorities without relaxing hard limits',()=>{
 const rows=[quote(1,{price:90000,down:40000,installment:1800,area:40}),quote(2,{price:100000,down:30000,installment:1900,area:55}),quote(3,{price:110000,down:35000,installment:1600,area:50}),quote(4,{price:120000,down:60000,installment:1200,area:80})];
 assert.equal(search.searchAgentQuotes(rows,preferences,[],'down')[0].unit,'2');
 assert.equal(search.searchAgentQuotes(rows,preferences,[],'monthly')[0].unit,'3');
 assert.equal(search.searchAgentQuotes(rows,preferences,[],'space')[0].unit,'2');
 assert.equal(search.searchAgentQuotes(rows,preferences,[],'price')[0].unit,'1');
});
test('advice without a customer objective asks one useful question before querying all project sources',async()=>{
 const plan={intent:'advice',reset:false,more:false,selected:null,unclearBudget:false,preferences:search.agentPreferencesSchema.parse({})};
 const h=harness([plan],[]);const result=await h.api.runMiaAgent([{direction:'inbound',content:'¿Qué me conviene?'}],{enabled:true});
 assert.match(result.reply,/vivir.*invertir/);assert.equal(h.calls.sources,0);
});
test('advice and proposals retain verified unit delivery even when the drafting model omits offers',async()=>{
 for(const intent of ['advice','proposal']){
  let step=0;const row=quote(7);const plan={intent,priority:'monthly',reset:false,more:false,selected:null,unclearBudget:false,preferences};
  const api=load('lib/mia-agent.ts',{
   '@/lib/mia-agent-search':search,'@/lib/mia-agent-memory':{},
   '@/lib/whatsapp-ai-provider':{generateGroqCustomerReply:async()=>JSON.stringify(step++===0?plan:{reply:'Voy a prepararte una propuesta.',evidence:[]})},
   '@/lib/whatsapp-sales-catalog':{salesDocumentExcerpt:s=>s},
   '@/lib/mia-project-trial':{MIA_TRIAL_POLICY:'Policy',loadMiaPublicCatalog:async()=>[project],loadMiaTrialContext:async()=>({documents:[{id:'web:'+project.slug,text:'Publicado',project:project.name}],quotes:[row],links:[project],issues:[]}),renderMiaTrialReply:raw=>JSON.parse(raw).reply},
  });
  const result=await api.runMiaAgent([{direction:'inbound',content:'Enviame una propuesta con menor cuota'}],{enabled:true});assert.match(result.reply,/MIA_COTIZACION/);assert.equal(result.memory.lastOffered[0].unit,'7');
 }
});

test('published delivery months are compared to the current year with explicit boundary handling',()=>{
 const facts=load('lib/mia-project-facts.ts'),now=new Date('2026-10-22T18:00:00Z');
 assert.equal(facts.miaPublishedDelivery({completionDate:'Diciembre 2026'},now).timing,'within_year');
 assert.equal(facts.miaPublishedDelivery({completionDate:'Diciembre 2027'},now).timing,'beyond_year');
 assert.equal(facts.miaPublishedDelivery({completionDate:'Octubre 2027'},now).timing,'boundary');
 assert.equal(facts.miaPublishedDelivery({completionDate:'Septiembre 2026'},now).timing,'past');
 assert.equal(facts.miaPublishedDelivery({completionDate:'No confirmada'},now),null);
 assert.match(facts.miaProjectFacts({name:'Palazzo',completionDate:'Diciembre 2026'},now),/dentro de los próximos 12 meses/);
});
test('an explicit project selection uses verified public facts without a drafting provider',async()=>{
 const facts=load('lib/mia-project-facts.ts'),trial=load('lib/mia-project-trial.ts');
 const feel={name:'Feel Palermo',slug:'feel-palermo',neighborhood:'Palermo',status:'en_construccion',completionDate:'Diciembre 2027'};let providerCalls=0,writes=0;
 const api=load('lib/mia-agent.ts',{
  '@/lib/mia-agent-search':search,'@/lib/whatsapp-ai-provider':{generateGroqCustomerReply:async()=>{providerCalls++;throw Error('rate limit')}},'@/lib/whatsapp-sales-catalog':{},
  '@/lib/mia-agent-memory':{readAgentMemory:async()=>search.emptyAgentMemory(),writeAgentMemory:async()=>{writes++}},
  '@/lib/mia-project-trial':{MIA_TRIAL_POLICY:'Policy',loadMiaPublicCatalog:async()=>[feel],loadMiaTrialContext:async()=>({documents:[{id:'web:feel-palermo',text:'Feel Palermo. Entrega diciembre 2027.'},{id:'catalog:feel-palermo',text:facts.miaProjectFacts(feel)}],links:[feel],issues:[],quotes:[]}),renderMiaTrialReply:trial.renderMiaTrialReply}
 });
 const result=await api.runMiaAgent([{id:'selection',direction:'inbound',content:'Feel Palermo'}],{enabled:true},'',{conversationId:'chat',scope:'test',memory:search.emptyAgentMemory(),crmContext:'Cliente pide entrega en menos de un año'});
 assert.match(result.reply,/Feel Palermo está publicado en construcción, en Palermo/);assert.match(result.reply,/diciembre de 2027/);assert.doesNotMatch(result.reply,/No pude verificar|Para orientarte|USD|\$/);assert.match(result.reply,/https:\/\/barrerabrokers.com\/desarrollos\/feel-palermo/);assert.equal(providerCalls,0);assert.equal(writes,1);assert.equal(result.memory.preferences.projects[0],'Feel Palermo');
});
test('invalid generated details fall back to verified project facts, never unverified amounts',async()=>{
 const facts=load('lib/mia-project-facts.ts'),trial=load('lib/mia-project-trial.ts'),p={...project,completionDate:'Diciembre 2027'};let calls=0;
 const api=load('lib/mia-agent.ts',{
  '@/lib/mia-agent-search':search,'@/lib/whatsapp-ai-provider':{generateGroqCustomerReply:async()=>JSON.stringify(calls++===0?{intent:'details',reset:false,more:false,selected:null,unclearBudget:false,preferences:{...preferences,projects:[p.name],neighborhoods:[]}}:{reply:'Cuesta USD 123456',evidence:[]})},'@/lib/whatsapp-sales-catalog':{salesDocumentExcerpt:s=>s},'@/lib/mia-agent-memory':{},
  '@/lib/mia-project-trial':{MIA_TRIAL_POLICY:'Policy',loadMiaPublicCatalog:async()=>[p],loadMiaTrialContext:async()=>({documents:[{id:'web:'+p.slug,project:p.name,text:'Entrega diciembre 2027',kind:'website'},{id:'catalog:'+p.slug,project:p.name,text:facts.miaProjectFacts(p),kind:'website'}],links:[p],issues:[],quotes:[]}),renderMiaTrialReply:trial.renderMiaTrialReply}
 });
 const result=await api.runMiaAgent([{direction:'inbound',content:'Contame las características del proyecto'}],{enabled:true});assert.match(result.reply,/diciembre de 2027/);assert.doesNotMatch(result.reply,/123456|USD|No pude verificar/);assert.equal(calls,3);
});

test('brochure follow-up retains the chosen project and does not lose an immediate-delivery preference',async()=>{
 const trial=load('lib/mia-project-trial.ts'),p={...project,completionDate:'Diciembre 2027'};let providerCalls=0;
 const memory=search.emptyAgentMemory();memory.preferences={...memory.preferences,projects:[p.name],delivery:'immediate',rooms:[2]};
 const api=load('lib/mia-agent.ts',{
  '@/lib/mia-agent-search':search,'@/lib/whatsapp-ai-provider':{generateGroqCustomerReply:async()=>{providerCalls++;throw Error('unavailable')}},'@/lib/whatsapp-sales-catalog':{},'@/lib/mia-agent-memory':{},
  '@/lib/mia-project-trial':{MIA_TRIAL_POLICY:'Policy',loadMiaPublicCatalog:async()=>[p],loadMiaTrialContext:async(config,slugs,options)=>{assert.equal(options.brochures,true);return {documents:[{id:'web:'+p.slug,text:'Ficha verificada'},{id:'brochure:'+p.slug,text:'Brochure verificado'}],links:[{...p,brochure:'https://drive.google.com/verified-brochure'}],quotes:[],issues:[]}},renderMiaTrialReply:trial.renderMiaTrialReply}
 });
 const result=await api.runMiaAgent([{direction:'inbound',content:'Me compartís el brochure'}],{enabled:true},'',{memory});assert.match(result.reply,/https:\/\/drive.google.com\/verified-brochure/);assert.equal(result.memory.preferences.delivery,'immediate');assert.equal(result.memory.preferences.rooms[0],2);assert.equal(providerCalls,0);
});

test('delivery acceptance is saved across turns and advances without asking again or resending the brochure',async()=>{
 const facts=load('lib/mia-project-facts.ts'),trial=load('lib/mia-project-trial.ts'),p={name:'Feel Palermo',slug:'feel-palermo',neighborhood:'Palermo',status:'en_construccion',completionDate:'Diciembre 2027'};
 let stored=search.emptyAgentMemory(),providerCalls=0;stored.preferences={...stored.preferences,rooms:[2],neighborhoods:['Palermo'],purpose:'investment'};
 const api=load('lib/mia-agent.ts',{
  '@/lib/mia-agent-search':search,'@/lib/whatsapp-ai-provider':{generateGroqCustomerReply:async()=>{providerCalls++;throw Error('Should not need a drafting provider')}},'@/lib/whatsapp-sales-catalog':{},
  '@/lib/mia-agent-memory':{readAgentMemory:async()=>search.agentMemorySchema.parse(JSON.parse(JSON.stringify(stored))),writeAgentMemory:async(id,scope,inbound,memory)=>{stored=search.agentMemorySchema.parse(JSON.parse(JSON.stringify(memory)))}},
  '@/lib/mia-project-trial':{MIA_TRIAL_POLICY:'Policy',loadMiaPublicCatalog:async()=>[p],loadMiaTrialContext:async(config,slugs,options)=>({documents:[{id:'web:'+p.slug,text:'Entrega diciembre 2027'},{id:'catalog:'+p.slug,text:facts.miaProjectFacts(p)},...(options.brochures?[{id:'brochure:'+p.slug,text:'Documento oficial verificado'}]:[])],links:[{...p,brochure:'https://drive.google.com/verified-brochure'}],quotes:[],issues:[]}),renderMiaTrialReply:trial.renderMiaTrialReply}
 });
 const dialogue=[{id:'goal',direction:'inbound',content:'Busco entrega en un año',createdAt:'2026-10-22T18:00:00Z'},{id:'project',direction:'inbound',content:p.name,createdAt:'2026-10-22T18:00:01Z'}],options={conversationId:'client-a',scope:'scope'};
 const first=await api.runMiaAgent(dialogue,{enabled:true},'',options);assert.match(first.reply,/alternativa cercana/);assert.match(first.reply,/¿Te sirven esos meses adicionales/);assert.equal(stored.deliveryPreference.acceptedProjects.length,0);
 dialogue.push({direction:'outbound',content:first.reply},{id:'accept',direction:'inbound',content:'Sí, me sirve',createdAt:'2026-10-22T18:01:00Z'});
 const second=await api.runMiaAgent(dialogue,{enabled:true},'',options);assert(stored.deliveryPreference.acceptedProjects.includes(p.name));assert.match(second.reply,/guardé que te sirve/);assert.match(second.reply,/https:\/\/drive.google.com\/verified-brochure/);assert.doesNotMatch(second.reply,/¿Te sirven|qué tipo de unidad/);assert.deepEqual(Array.from(stored.preferences.rooms),[2]);assert.equal(stored.preferences.purpose,'investment');assert.deepEqual(Array.from(stored.preferences.neighborhoods),['Palermo']);
 dialogue.push({direction:'outbound',content:second.reply},{id:'again',direction:'inbound',content:p.name,createdAt:'2026-10-22T18:02:00Z'});
 const third=await api.runMiaAgent(dialogue,{enabled:true},'',options);assert.match(third.reply,/aceptaste ese margen/);assert.doesNotMatch(third.reply,/¿Te sirven|¿Querés que te comparta el brochure/);assert.equal(providerCalls,0);
});

test('strict deadlines also filter automatic offers before source lookup, without changing information-only project access',async()=>{
 const p={name:'Feel Palermo',slug:'feel-palermo',neighborhood:'Palermo',status:'en_construccion',completionDate:'Diciembre 2027'};let sources=0;
 const api=load('lib/mia-agent.ts',{
  '@/lib/mia-agent-search':search,'@/lib/whatsapp-ai-provider':{generateGroqCustomerReply:async()=>JSON.stringify({intent:'search',reset:false,more:false,selected:null,unclearBudget:false,preferences:{...search.agentPreferencesSchema.parse({}),rooms:[2],neighborhoods:['Palermo']}})},'@/lib/whatsapp-sales-catalog':{},'@/lib/mia-agent-memory':{},
  '@/lib/mia-project-trial':{MIA_TRIAL_POLICY:'Policy',loadMiaPublicCatalog:async()=>[p],loadMiaTrialContext:async()=>{sources++;throw Error('An incompatible project must not be offered')},renderMiaTrialReply:()=>{throw Error('Must not render incompatible offers')}}
 });
 const result=await api.runMiaAgent([{direction:'inbound',content:'Busco dos ambientes en Palermo, máximo un año de entrega',createdAt:'2026-10-22T18:00:00Z'}],{enabled:true});assert.equal(result.memory.deliveryPreference.strict,true);assert.equal(sources,0);assert.doesNotMatch(result.reply,/Precio de lista|USD|MIA_COTIZACION/);
});

test('a nearby automatic offer explains the delivery difference and never invents acceptance',async()=>{
 const facts=load('lib/mia-project-facts.ts'),trial=load('lib/mia-project-trial.ts'),p={name:'Feel Palermo',slug:'feel-palermo',neighborhood:'Palermo',status:'en_construccion',completionDate:'Diciembre 2027'},q={...quote(12),project:'Feel Palermo'};let calls=0;
 const api=load('lib/mia-agent.ts',{
  '@/lib/mia-agent-search':search,'@/lib/whatsapp-ai-provider':{generateGroqCustomerReply:async()=>JSON.stringify(calls++===0?{intent:'search',reset:false,more:false,selected:null,unclearBudget:false,preferences:{...search.agentPreferencesSchema.parse({}),rooms:[2],neighborhoods:['Palermo']}}:{reply:'Veamos las opciones que encajan.',evidence:[]})},'@/lib/whatsapp-sales-catalog':{salesDocumentExcerpt:s=>s},'@/lib/mia-agent-memory':{},
  '@/lib/mia-project-trial':{MIA_TRIAL_POLICY:'Policy',loadMiaPublicCatalog:async()=>[p],loadMiaTrialContext:async()=>({documents:[{id:'web:'+p.slug,project:p.name,text:'Entrega diciembre 2027',kind:'website'},{id:'catalog:'+p.slug,project:p.name,text:facts.miaProjectFacts(p),kind:'website'}],links:[p],quotes:[q],issues:[]}),renderMiaTrialReply:trial.renderMiaTrialReply}
 });
 const result=await api.runMiaAgent([{direction:'inbound',content:'Busco dos ambientes en Palermo, en un año',createdAt:'2026-10-22T18:00:00Z'}],{enabled:true});assert.match(result.reply,/diciembre de 2027/);assert.match(result.reply,/alternativa cercana/);assert.match(result.reply,/falta que confirmes/);assert.match(result.reply,/Unidad 12/);assert.equal(result.memory.deliveryPreference.acceptedProjects.length,0);
});
test('natural requests select Palazzo from verified sources without a drafting model',async()=>{
 const trial=load('lib/mia-project-trial.ts'),p={name:'Palazzo Ducale',slug:'palazzo-ducale',neighborhood:'Palermo',status:'en_construccion',completionDate:'Diciembre 2026'};let calls=0;
 const api=load('lib/mia-agent.ts',{
 '@/lib/mia-agent-search':search,'@/lib/whatsapp-ai-provider':{generateGroqCustomerReply:async()=>{calls++;throw Error('unavailable')}},'@/lib/whatsapp-sales-catalog':{},
 '@/lib/mia-agent-memory':{},'@/lib/mia-project-trial':{MIA_TRIAL_POLICY:'Policy',loadMiaPublicCatalog:async()=>[p],loadMiaTrialContext:async()=>({documents:[{id:'web:'+p.slug,text:'Entrega diciembre 2026'}],links:[p],issues:[],quotes:[]}),renderMiaTrialReply:trial.renderMiaTrialReply}});
 for(const content of ['Pasame Palazzo Ducale','Mandame Palazzo Ducale, por favor','Mostrame el proyecto Palazzo Ducale','¿Me pasás Palazzo Ducale?']){
 const result=await api.runMiaAgent([{direction:'inbound',content}],{enabled:true});assert.match(result.reply,/diciembre de 2026/);assert.match(result.reply,/desarrollos\/palazzo-ducale/);assert.equal(result.memory.preferences.projects[0],p.name);
 }assert.equal(calls,0);
});
test('a campaign search with no matching verified rows continues with official sources, not the generic failure',async()=>{
 const plan={intent:'search',reset:false,more:false,selected:null,unclearBudget:false,preferences};const h=harness([plan],[]);
 const result=await h.api.runMiaAgent([{direction:'inbound',content:'Preferentemente Núñez y alrededores'}],{enabled:true});assert.match(result.reply,/Para proponerte una unidad concreta/);assert.match(result.reply,/confirmar su disponibilidad, precio/);assert.match(result.reply,/fichas oficiales/);assert.doesNotMatch(result.reply,/no encontr[eé]|no hay opciones|No pude verificar ese dato|agotad|USD|\$/);assert.equal(h.calls.prompts.length,1);assert.equal(result.memory.preferences.rooms[0],2);assert.equal(result.memory.pendingQuestions.length,1);
});
test('sticker placeholders do not enter the commercial facts model',async()=>{
 const h=harness([],[]);const result=await h.api.runMiaAgent([{direction:'inbound',content:'[El cliente envió un sticker]'}],{enabled:true});assert.match(result.reply,/sticker/);assert.equal(h.calls.prompts.length,0);assert.doesNotMatch(result.reply,/verificar|fuentes/);
});
test('thinking objection is answered and persisted even when catalog/provider are unavailable',async()=>{
 const memory=search.emptyAgentMemory();memory.preferences.rooms=[2];let writes=0;
 const api=load('lib/mia-agent.ts',{'@/lib/mia-agent-search':search,'@/lib/mia-agent-memory':{readAgentMemory:async()=>memory,writeAgentMemory:async(id,scope,inbound,value)=>{assert.equal(inbound,'thinking');assert.equal(value.preferences.rooms[0],2);writes++;}},'@/lib/mia-project-trial':{loadMiaPublicCatalog:async()=>{throw Error('must not fetch')}},'@/lib/whatsapp-ai-provider':{generateGroqCustomerReply:async()=>{throw Error('must not call')}}});
 const result=await api.runMiaAgent([{id:'thinking',direction:'inbound',content:'quiero pensarlo'}],{enabled:true},'',{conversationId:'chat',scope:'test'});assert.match(result.reply,/qué parte te gustaría pensar: la financiación o la unidad/);assert.equal(writes,1);
 const second=await api.runMiaAgent([{direction:'outbound',content:'Alpha Place Libertador · Unidad 702'},{id:'thinking',direction:'inbound',content:'voy a pensarlo mejor'}],{enabled:true},'',{conversationId:'chat',scope:'test'});assert.match(second.reply,/qué parte te gustaría pensar: la financiación o la unidad/);assert.doesNotMatch(second.reply,/Unidad 702|Precio de lista/);assert.equal(writes,2);
});
