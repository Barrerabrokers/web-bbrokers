const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
function load(file,mocks={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>mocks[n]||(n.startsWith('@/')?load(n.replace('@/','')+'.ts',mocks):require(n)),console,Date,process,URL,Buffer,AbortSignal,fetch,Intl});return module.exports;}
const access=load('lib/mia-access.ts');
test('pilot permits exact conversation ID, never names, other channels or new contacts',()=>{const a=access.parseMiaAccess(JSON.stringify({mode:'pilot',conversationIds:['authorized']}));assert(access.miaAccessAllows(a,'authorized'));for(const id of ['other','Pablo Barrera','',undefined])assert(!access.miaAccessAllows(a,id));assert(!access.miaAccessAllows(access.parseMiaAccess('bad'),'authorized'));});
test('sending gate checks pilot setting even for previously pending handoff acknowledgements',()=>{const source=fs.readFileSync('lib/whatsapp-turn-lock.ts','utf8');for(const name of ['claimWhatsAppAiSend','claimInstagramAiSend']){const part=source.split('export async function '+name)[1].split('\n}')[0];assert(part.includes("s.key='mia-access-v1'"));assert(part.includes("conversationIds"));}assert(!source.split('export async function claimWhatsAppHumanSend')[1].split('\n}')[0].includes('mia-access-v1'));});
function consultant(result,onPrompt=()=>{}){return load('lib/mia-consultative.ts',{'@/lib/whatsapp-ai-provider':{generateGroqCustomerReply:async(prompt)=>{onPrompt(prompt);return JSON.stringify(result)}},'@/lib/mia-guidance':{getMiaGuidance:async()=>({instructions:'Regla administradora',corrections:[]}),miaGuidancePrompt:()=> 'Regla administradora'},'@/lib/whatsapp-admin-learning':{listAdministratorLearning:async()=>[{question:'Quiero invertir',answer:'Veamos qué necesitás'}]},'@/lib/whatsapp-mia-sources':{...load('lib/whatsapp-mia-sources.ts'),loadMiaSourceContext:async()=>({references:[],issues:[]})}});}
const state={stage:'conversacion_comercial',facts:{neighborhoods:[]},offers:[]},sources={projectsUrl:''};
test('free language stores purpose and remembers prior needs without imposing numeric menus',async()=>{let prompt='';const m=consultant({reply:'¡Qué bueno! ¿Buscás una unidad para usar o para generar renta?',action:'continue',interest:{purpose:'para renta'}},p=>prompt=p);const d=await m.advanceMiaConsultative(state,'Busco en Núñez para renta',[{direction:'inbound',content:'Busco en Núñez para renta',status:'received'}],sources,async()=>[]);assert.equal(d.next.facts.neighborhoods[0],'Núñez');assert.equal(d.next.interest.purpose,'para renta');assert.equal(d.next.stage,'conversacion_comercial');assert(!/1️⃣|2️⃣/.test(d.reply));assert(prompt.includes('Regla administradora'));assert(prompt.includes('ropa blanca'));assert(prompt.includes('Veamos qué necesitás'));});
test('inventions and price-list links from the model are rejected',()=>{const m=consultant({});for(const bad of ['Mirá https://docs.google.com/spreadsheets/d/prices','Sale USD 100000','La rentabilidad garantizada es alta','Te envío el brochure por correo'])assert(!m.safeMiaConversationalReply(bad));assert(m.safeMiaConversationalReply('¿La buscás para vivir o como inversión?'));});
test('existing form budget stays intact and enough preferences trigger real inventory search',async()=>{const m=consultant({reply:'Te busco opciones',action:'search'});let called=0;const start={...state,facts:{neighborhoods:['Núñez'],deliveryMonths:36,rooms:2,budget:{original:'Anticipo 40000 y cuotas 1800',down:40000,monthly:1800}}};const d=await m.advanceMiaConsultative(start,'Mostrame opciones',[{direction:'inbound',content:'Mostrame opciones',status:'received'}],sources,async f=>{called++;assert.equal(f.budget.down,40000);return []});assert.equal(called,1);assert(!/cu[aá]l.*presupuesto/i.test(d.reply));});
test('human requests bypass sales and stop Mia, preserving conversation context',async()=>{const m=consultant({reply:'No debería ejecutarse'});const d=await m.advanceMiaConsultative({...state,interest:{purpose:'para renta'}},'Quiero hablar con un asesor',[],sources,async()=>{throw Error('no inventory')});assert(d.handoff);assert.equal(d.next.interest.purpose,'para renta');});
test('quotes keep verified amounts but never expose the source price-list link',()=>{const {renderMiaQuote}=load('lib/whatsapp-mia-sources.ts');const reply=renderMiaQuote({project:'Prueba',unit:'1A',price:100000,currency:'USD',source:'https://docs.google.com/spreadsheets/d/private',row:5,readAt:new Date().toISOString()});assert(reply.includes('100.000'));assert(!reply.includes('docs.google'));assert(!reply.includes('Fuente:'));});
test('a failed search keeps a consultative next step and does not repeat the same search on every message',async()=>{
 const start={...state,facts:{neighborhoods:['Núñez'],deliveryMonths:36,rooms:2}};let calls=0;
 const first=await consultant({action:'search'}).advanceMiaConsultative(start,'Mostrame opciones',[],sources,async()=>{calls++;return []});assert(!first.handoff);assert.equal(first.next.reason,'busqueda_sin_resultados');
 const next=await consultant({action:'continue',reply:'Podemos revisar una zona cercana. ¿Te interesaría Belgrano?'}).advanceMiaConsultative(first.next,'¿Y qué otra zona podría ser?',[],sources,async()=>{calls++;return []});assert.equal(calls,1);assert(!next.handoff);assert(next.reply.includes('Belgrano'));
});

test('Puedo esperar is retained and searches real offers without inventing a numeric ceiling',async()=>{
 const m=consultant({reply:'¿Buscás algo para usar pronto o podés esperar a que termine la obra?',action:'continue'});let searched=0;
 const unit={project:'Proyecto prueba',unit:'101',price:100000,currency:'USD',rooms:2,area:'50 m²',floor:'1',deliveryMonths:30,neighborhood:'Núñez',planUrls:['https://example.com/exact-plan.pdf'],down:40000,months:30,installment:2000};
 const start={...state,facts:{neighborhoods:['Núñez'],rooms:2,budget:{original:'formulario',down:50000,monthly:2500}}};
 const result=await m.advanceMiaConsultative(start,'Puedo esperar',[],sources,async facts=>{searched++;assert.equal(facts.deliveryMonths,undefined);assert.equal(facts.deliveryPreference,'can_wait');return [unit]},{manualPause:true});
 assert.equal(searched,1);assert.equal(result.next.offers[0].unit,'101');assert(!result.handoff);assert(!result.reply.includes('podés esperar'));
 const fits=load('lib/mia-sequence.ts').miaUnitFits;assert(!fits({...unit,installment:2600},result.next.facts));assert(!fits({...unit,deliveryMonths:undefined},result.next.facts));
});
test('free waiting answers advance to the next missing fact even with a rejected model reply',async()=>{
 const m=consultant({reply:'¿Buscás algo para usar pronto o podés esperar a que termine la obra?',action:'continue'});
 const first=await m.advanceMiaConsultative({...state,facts:{neighborhoods:['Palermo']}},'Puedo esperar',[],sources,async()=>[]);
 assert.equal(first.next.facts.deliveryPreference,'can_wait');assert.equal(first.next.facts.deliveryMonths,undefined);assert(/ambientes/.test(first.reply));
 const second=await m.advanceMiaConsultative(first.next,'No tengo apuro',[{direction:'outbound',content:first.reply,status:'sent'}],sources,async()=>[]);
 assert(!/podés esperar|usar pronto/.test(second.reply));assert.notEqual(second.reply,first.reply);
});
test('a known maximum remains binding when customer says they can wait',()=>{
 const context=load('lib/mia-context-facts.ts'),sequence=load('lib/mia-sequence.ts');
 const facts=context.recoverMiaConversationFacts({neighborhoods:['Palermo'],rooms:1,deliveryMonths:24},[{direction:'inbound',status:'received',content:'Puedo esperar'}]);
 assert.equal(facts.deliveryMonths,24);assert.equal(sequence.miaMissingStage(facts),'busqueda_unidades');
});
test('negative and hypothetical waiting statements never mean willingness',()=>{
 const sequence=load('lib/mia-sequence.ts');for(const text of ['No puedo esperar','No quiero esperar','¿Puedo esperar?'])assert(!['can_wait','flexible'].includes(sequence.parseMiaPreferences(text,'conversacion_comercial').deliveryPreference));
});
test('plain safe provider prose survives a format failure, while repeated questions do not',async()=>{
 const mocks={'@/lib/whatsapp-ai-provider':{generateGroqCustomerReply:async()=> 'Es una decisión importante. ¿Qué es lo que más te preocupa de comprar en obra?'},'@/lib/mia-guidance':{getMiaGuidance:async()=>({}),miaGuidancePrompt:()=>''},'@/lib/whatsapp-admin-learning':{listAdministratorLearning:async()=>[]}};
 const m=load('lib/mia-consultative.ts',mocks);const result=await m.advanceMiaConsultative(state,'Me da miedo comprar en obra',[],sources,async()=>[]);
 assert(result.reply.includes('preocupa'));assert(m.miaReplyRepeatsKnownQuestion('¿Podés esperar a que termine la obra?',{...state,facts:{neighborhoods:['Palermo'],deliveryPreference:'can_wait'}},[]));
 assert(m.miaReplyRepeatsKnownQuestion('¿Qué cantidad de ambientes necesitás?',{...state,facts:{neighborhoods:[],rooms:2}},[]));
});
test('short written room counts use the preceding question rather than repeating it',()=>{
 const recover=load('lib/mia-context-facts.ts').recoverMiaConversationFacts;
 for(const [answer,count] of [['Dos',2],['Tres',3],['1',1]]){
 const facts=recover({neighborhoods:['Palermo'],deliveryPreference:'can_wait'},[{direction:'outbound',status:'sent',content:'¿Qué cantidad de ambientes necesitás?'},{direction:'inbound',status:'received',content:answer}]);assert.equal(facts.rooms,count);
 }
});
test('semantic waiting interpretation accepts grounded free wording and appends a useful next question to an acknowledgement',async()=>{
 const m=consultant({reply:'Buenísimo, podemos considerar obra.',action:'continue',evidence:{deliveryPreference:'me sirve aguardar al final de la obra'},interpretation:{deliveryPreference:'can_wait'}});
 const d=await m.advanceMiaConsultative({...state,facts:{neighborhoods:['Palermo']}},'me sirve aguardar al final de la obra',[],sources,async()=>[]);
 assert.equal(d.next.facts.deliveryPreference,'can_wait');assert.equal(d.next.facts.deliveryMonths,undefined);assert(/ambientes/.test(d.reply));
 const bad=await m.advanceMiaConsultative({...state,facts:{neighborhoods:['Palermo']}},'¿Podría esperar?',[],sources,async()=>[]);assert.equal(bad.next.facts.deliveryPreference,undefined);
});
test('a partial semantic evidence fragment cannot override an explicit negative answer',async()=>{
 const m=consultant({reply:'Entiendo que necesitás recibirlo pronto.',evidence:{deliveryPreference:'esperar'},interpretation:{deliveryPreference:'can_wait'}});
 const d=await m.advanceMiaConsultative({...state,facts:{neighborhoods:['Palermo']}},'No puedo esperar',[],sources,async()=>[]);
 assert.equal(d.next.facts.deliveryPreference,'soon');assert(!/proyectos en obra/.test(d.reply));
});
test('a model cannot announce availability or imminent delivery before inventory has been searched',async()=>{
 const m=consultant({reply:'Te presento las opciones disponibles en Núñez con entrega en los próximos meses. ¿Qué cantidad de ambientes necesitás?',action:'continue'});
 const d=await m.advanceMiaConsultative({...state,facts:{neighborhoods:['Núñez']}},'Puedo esperar',[],sources,async()=>{throw Error('Missing rooms')});
 assert(!/disponibles|próximos meses/.test(d.reply));assert(/ambientes/.test(d.reply));assert.equal(d.next.facts.deliveryPreference,'can_wait');
});
test('an investment concern is heard without asking the customer their already expressed purpose again',async()=>{
 const m=consultant({reply:'Entiendo tu inquietud, es una decisión importante. ¿Para qué planeás usar la propiedad? ¿Vivir, invertir, revender o renta?',action:'continue'});
 const d=await m.advanceMiaConsultative(state,'Me da miedo comprar en obra, es la primera vez que invierto',[],sources,async()=>[]);
 assert.equal(d.next.interest.purpose,'invertir');assert(d.reply.includes('Entiendo tu inquietud'));assert(!/para qué|Vivir, invertir/.test(d.reply));
});
test('a question containing new preferences is answered before searching, and concerns remain in context',async()=>{
 let searches=0,prompt='';const text='Busco en Recoleta, pero me preocupa comprar en obra. ¿Cómo me acompañan?';
 const m=consultant({intent:'concern',action:'continue',reply:'Te acompañamos a revisar el proyecto y sus condiciones, paso a paso.',remember:[{kind:'concern',evidence:'me preocupa comprar en obra'}]},p=>prompt=p);
 const d=await m.advanceMiaConsultative({...state,facts:{neighborhoods:['Núñez'],rooms:2,deliveryMonths:36}},text,[],sources,async()=>{searches++;return []});
 assert.equal(searches,0);assert(d.reply.includes('paso a paso'));assert.equal(d.next.facts.neighborhoods[0],'Recoleta');assert.equal(d.next.memory.notes[0].text,'me preocupa comprar en obra');
 await m.advanceMiaConsultative(d.next,'¿Y si después quiero renta?',[],sources,async()=>[]);assert(prompt.includes('me preocupa comprar en obra'));
});
test('greetings and thanks do not force proposals just because all qualifying facts are known',async()=>{
 let calls=0;const m=consultant({intent:'conversation',action:'continue',reply:'¡Hola! Acá estoy para ayudarte 😊'});
 const d=await m.advanceMiaConsultative({...state,facts:{neighborhoods:['Núñez'],rooms:2,deliveryMonths:36}},'Hola',[],sources,async()=>{calls++;return []});assert.equal(calls,0);assert(d.reply.includes('Hola'));
});
test('asking why the expensive option costs more does not select it',async()=>{
 const m=consultant({intent:'question',action:'continue',reply:'Podemos comparar la superficie y la ubicación de ambas unidades.'});
 const start={...state,stage:'unidades_presentadas',facts:{neighborhoods:['Núñez'],rooms:2,deliveryMonths:36},offers:[{project:'Prueba',unit:'101',rooms:2},{project:'Prueba',unit:'201',rooms:2}]};
 const d=await m.advanceMiaConsultative(start,'¿Por qué es más cara la segunda?',[],sources,async()=>{throw Error('Unexpected search')});assert.equal(d.next.selected,undefined);assert(d.reply.includes('comparar'));
});
test('natural amount questions use server values rather than repeating a proposal or refusing all prices',async()=>{
 const m=consultant({intent:'question',action:'continue',reply:'El anticipo es {{oferta1.anticipo}} y el saldo en {{oferta1.pagos}}.'});
 const unit={project:'Prueba',unit:'104',rooms:1,price:130325,currency:'USD',down:52130,months:30,installment:2606.5,source:'https://docs.google.com/spreadsheets/d/source',readAt:new Date().toISOString(),adjustment:'Cuotas sujetas a CAC.'};
 const d=await m.advanceMiaConsultative({...state,stage:'unidades_presentadas',facts:{neighborhoods:['Núñez'],rooms:1,deliveryMonths:36},offers:[unit]},'¿Cuánto es el anticipo de la primera?',[],sources,async()=>{throw Error('Unexpected search')});assert(d.reply.includes('USD 52.130'));assert(d.reply.includes('2.606,50'));assert(d.reply.includes('CAC'));assert(!d.reply.includes('docs.google'));
});
test('asking about an alternative use does not overwrite the confirmed purchase purpose',async()=>{
 const m=consultant({intent:'question',action:'continue',reply:'Podés evaluar la renta después de la entrega; ofrecemos administrarla.'});
 const start={...state,interest:{purpose:'vivir'}};
 const d=await m.advanceMiaConsultative(start,'¿Y si después quiero renta?',[],sources,async()=>[]);assert.equal(d.next.interest.purpose,'vivir');
 const negative=await m.advanceMiaConsultative(start,'No quiero invertir',[],sources,async()=>[]);assert.notEqual(negative.next.interest.purpose,'invertir');
});
test('conversation context includes the known name and contact presence without exposing reservation identifiers',async()=>{
 let prompt='';const m=consultant({intent:'conversation',reply:'¡Hola! Acá estoy para ayudarte.'},p=>prompt=p);
 await m.advanceMiaConsultative({...state,reservation:{fullName:'Nombre Prueba',email:'prueba@example.com',phone:'1112345678',dni:'12345678'}},'Hola',[],sources,async()=>[]);
 assert(prompt.includes('Nombre Prueba'));assert(prompt.includes('emailKnown'));assert(!prompt.includes('12345678'));assert(!prompt.includes('prueba@example.com'));
});
test('selecting a zone still explains its attraction when criteria immediately trigger inventory',async()=>{
 const m=consultant({});let calls=0;const d=await m.advanceMiaConsultative({...state,facts:{neighborhoods:[],rooms:2,deliveryMonths:36}},'Palermo',[],sources,async()=>{calls++;return []});assert.equal(calls,1);assert(d.reply.includes('Bosques'));assert(d.next.neighborhoodIntroductions.includes('Palermo'));
});
test('Drive and public website references reach the model in separate sections with explicit source priority',async()=>{
 let prompt='';const m=load('lib/mia-consultative.ts',{'@/lib/whatsapp-ai-provider':{generateGroqCustomerReply:async p=>{prompt=p;return JSON.stringify({intent:'question',reply:'La terraza y el gimnasio figuran en la ficha publicada.'})}},'@/lib/mia-guidance':{getMiaGuidance:async()=>({}),miaGuidancePrompt:()=>''},'@/lib/whatsapp-admin-learning':{listAdministratorLearning:async()=>[]},'@/lib/mia-website-context':{loadMiaWebsiteContext:async()=>({references:[{title:'Web Barrera Brokers · Prueba',url:'https://barrerabrokers.com/desarrollos/prueba',text:'Terraza y gimnasio.'}],issues:[]})},'@/lib/whatsapp-mia-sources':{loadMiaSourceContext:async()=>({references:[{title:'Brochure prueba',text:'Balcones y cocinas equipadas.'}],quotes:[],issues:[]})}});
 const d=await m.advanceMiaConsultative({...state,facts:{neighborhoods:['Palermo']}},'¿Qué amenities tiene el proyecto?',[],sources,async()=>[]);assert(d.reply.includes('terraza'));assert(prompt.includes('Terraza y gimnasio'));assert(prompt.includes('Balcones y cocinas'));assert(prompt.includes('prioridad para precios'));assert(prompt.includes('Rosedal'));
});

test('new proposals show one option per turn, preserve the pair, and reveal the next only when requested',async()=>{
 const m=consultant({intent:'question',reply:'¿Qué te importa más para esta compra?',action:'continue'});
 const units=[101,201].map((id,i)=>({project:'Prueba',unit:String(id),price:100000+i*10000,currency:'USD',rooms:2,area:'50 m²',floor:String(i+1),deliveryMonths:24,neighborhood:'Palermo',planUrls:['https://example.com/plan-'+id+'.pdf'],down:40000+i*4000,months:30,installment:2000,source:'https://example.com/source',readAt:new Date().toISOString()}));
 const start={...state,facts:{neighborhoods:['Palermo'],rooms:2,deliveryMonths:36},neighborhoodIntroductions:['Palermo']};let calls=0;
 const first=await m.advanceMiaConsultative(start,'Mandame opciones',[],sources,async()=>{calls++;return units});
 assert(first.reply.includes('Unidad 101'));assert(!first.reply.includes('201'));assert.equal(first.next.offers.length,2);assert.equal(first.next.offerPresentation.shown,1);
 const context=load('lib/mia-answer-context.ts');assert.equal(context.miaAnswerContext(first.next).units.length,1);assert.equal(context.renderMiaAnswerTokens('{{oferta2.precio}}',first.next),undefined);
 const question=await m.advanceMiaConsultative(JSON.parse(JSON.stringify(first.next)),'¿Cómo se adapta a mi idea de revender?',[],sources,async()=>{throw Error('Unexpected search')});assert.equal(question.next.offerPresentation.shown,1);assert(!question.reply.includes('201'));
 const second=await m.advanceMiaConsultative(question.next,'Mostrame la otra opción',[],sources,async()=>{throw Error('Unexpected fresh search')});
 assert(second.reply.includes('Unidad 201'));assert(!second.reply.includes('Unidad 101'));assert(!second.reply.includes('La más económica'));assert.equal(second.next.offerPresentation.shown,2);assert.equal(second.next.selected,undefined);assert.equal(calls,1);
});
test('finishing preferences can invite a relevant discovery question without forcing inventory, while explicit options bypass it',async()=>{
 let calls=0;const m=consultant({intent:'preference',action:'continue',reply:'Perfecto. ¿Qué te llevó a elegir esta zona para tu inversión?'});
 const start={...state,facts:{neighborhoods:['Palermo'],deliveryMonths:36},interest:{purpose:'invertir'}};
 const d=await m.advanceMiaConsultative(start,'Dos ambientes',[],sources,async()=>{calls++;return []});assert.equal(calls,0);assert(d.reply.includes('Qué te llevó'));assert.equal(d.next.facts.rooms,2);
 await m.advanceMiaConsultative(d.next,'Mandame opciones',[],sources,async()=>{calls++;return []});assert.equal(calls,1);
});
test('an old pending second option is refreshed instead of sending stale amounts',async()=>{
 const m=consultant({});const unit={project:'Prueba',unit:'101',price:100000,currency:'USD',rooms:2,area:'50 m²',floor:'1',deliveryMonths:24,neighborhood:'Palermo',planUrls:['https://example.com/plan.pdf'],down:40000,months:30,installment:2000,source:'https://example.com/source',readAt:'2020-01-01T00:00:00Z'};
 const start={...state,stage:'unidades_presentadas',facts:{neighborhoods:['Palermo'],rooms:2,deliveryMonths:36},offers:[unit,{...unit,unit:'201',price:110000}],offerPresentation:{shown:1},neighborhoodIntroductions:['Palermo']};let calls=0;
 const d=await m.advanceMiaConsultative(start,'Otra opción',[],sources,async()=>{calls++;return [unit,{...unit,unit:'201',price:120000,readAt:new Date().toISOString()}]});assert.equal(calls,1);assert(d.reply.includes('Unidad 201'));assert.equal(d.next.offers[1].price,120000);
});

test('known room preference also suppresses generic housing-type requalification',()=>{assert(consultant({}).miaReplyRepeatsKnownQuestion('¿Qué tipo de vivienda buscas en Recoleta?',{...state,facts:{neighborhoods:['Recoleta'],rooms:2}},[]));});

test('full rollout retains the consultative assistant and admits existing and future conversations',()=>{for(const mode of ['pilot','all'])assert(access.miaConsultativeEnabled(access.parseMiaAccess({mode})));const all=access.parseMiaAccess({mode:'all',pausePolicy:'manual'});assert(all.manualPause);for(const id of ['existing','new'])assert(access.miaAccessAllows(all,id));assert(!access.miaConsultativeEnabled(access.parseMiaAccess({mode:'disabled'})));assert(fs.readFileSync('lib/mia-sequence-store.ts','utf8').includes('const consultative=miaConsultativeEnabled(access)'));});

test('an empty verified search keeps preferences and offers a constructive next step',async()=>{
 const m=consultant({reply:'',action:'search'});
 const facts={neighborhoods:['Belgrano','Núñez'],rooms:2,deliveryPreference:'can_wait'};
 const d=await m.advanceMiaConsultative({...state,facts},'Mostrame opciones',[],sources,async()=>[]);
 assert(!m.miaClosesSearch(d.reply));assert(d.notifyAdvisor);assert(/equipo/.test(d.reply));
 assert.equal(JSON.stringify(d.next.facts),JSON.stringify(facts));assert.equal(d.next.stage,'conversacion_comercial');assert.equal(d.next.offers.length,0);
});
test('model replies cannot close the search by claiming there are no options',async()=>{
 for(const reply of ['No hay opciones en esa zona.','No encontré una unidad verificable que cumpla todos esos criterios.','No tenemos departamentos para vos.']){
  const m=consultant({reply,action:'continue'});
  const d=await m.advanceMiaConsultative(state,'Gracias',[],sources,async()=>[]);
  assert(!m.miaClosesSearch(d.reply));assert(d.notifyAdvisor);assert(/equipo/.test(d.reply));
 }
});

 test('reworded questions are blocked across the full active history',()=>{
 const m=consultant({}),history=[{direction:'outbound',status:'sent',content:'¿Qué cantidad de ambientes necesitás?'},...Array.from({length:8},()=>({direction:'outbound',status:'sent',content:'Seguimos con tu consulta.'}))];
 assert(m.miaReplyRepeatsKnownQuestion('¿Buscás un monoambiente o necesitás más espacio?',state,history));
 assert(!m.miaReplyRepeatsKnownQuestion('¿Qué cantidad de ambientes necesitás?',state,[...history,{direction:'unknown',status:'cleared',content:''}]));
 });
 test('lost state recovers earlier customer facts before asking again',async()=>{
 const history=[{direction:'inbound',status:'received',content:'Busco dos ambientes en Palermo. Puedo esperar.'},{direction:'outbound',status:'sent',content:'Lo tengo en cuenta.'}];
 const d=await consultant({reply:'¿Qué cantidad de ambientes necesitás?',action:'continue'}).advanceMiaConsultative(state,'Gracias',history,sources,async()=>[]);
 assert.equal(d.next.facts.rooms,2);assert.equal(d.next.facts.neighborhoods[0],'Palermo');assert.equal(d.next.facts.deliveryPreference,'can_wait');assert(!d.reply.includes('?'));
 });
 test('provider failure does not cycle through paraphrases of the same qualification',async()=>{
 const m=consultant({});const history=[{direction:'outbound',status:'sent',content:'¿En qué zona te gustaría comprar?'}];
 const d=await m.advanceMiaConsultative(state,'Todavía estoy mirando',history,sources,async()=>[]);
 assert(!d.reply.includes('?'));assert(!/Contame/.test(d.reply));
 });
 test('deterministic search continuations also suppress repeated priority questions',async()=>{
 const start={...state,facts:{neighborhoods:['Palermo'],rooms:2,deliveryPreference:'can_wait'}};
 const d=await consultant({}).advanceMiaConsultative(start,'Mostrame opciones',[{direction:'outbound',status:'sent',content:'¿Qué te gustaría priorizar al comparar las opciones?'}],sources,async()=>[]);
 assert(!d.reply.includes('?'));assert(d.notifyAdvisor);assert(d.reply.includes('equipo'));
 });
test('cash benefit is answered with approved amounts from the current project, even in a short follow-up',async()=>{
 let prompt='';const guidance={instructions:'[Feel Palermo · aprobación · 19/10/2026]\nDe contado, renta hasta entrega: {{feel_palermo.renta_1_ambiente}}.\n[Fin Feel Palermo]',corrections:[],revision:1,approvedProjectValues:{'Feel Palermo':{'feel_palermo.renta_1_ambiente':'USD 500 mensuales'}}};
 const m=load('lib/mia-consultative.ts',{'@/lib/mia-guidance':{getMiaGuidance:async()=>guidance,miaGuidancePrompt:()=>guidance.instructions},'@/lib/whatsapp-ai-provider':{generateGroqCustomerReply:async p=>{prompt=p;return JSON.stringify({intent:'question',action:'continue',reply:'Al pagar de contado el monoambiente, el beneficio hasta la entrega es {{feel_palermo.renta_1_ambiente}}. El asesor confirma las condiciones contractuales.'});}},'@/lib/whatsapp-admin-learning':{listAdministratorLearning:async()=>[]},'@/lib/whatsapp-mia-sources':{loadMiaSourceContext:async()=>({references:[],quotes:[],issues:[]})},'@/lib/mia-website-context':{loadMiaWebsiteContext:async()=>({references:[],issues:[]})}});
 const result=await m.advanceMiaConsultative(state,'¿Cuánto recibo si pago de contado?',[{direction:'inbound',status:'received',content:'Me interesa Feel Palermo'}],sources,async()=>{throw Error('Do not search instead of answering');});
 assert(prompt.includes('USD 500 mensuales'));assert(result.reply.includes('USD 500 mensuales'));assert(result.reply.includes('de contado'));assert(result.reply.includes('hasta la entrega'));
});
test('Nueva busqueda deterministically searches again despite unchanged facts and a broken provider',async()=>{
 let calls=0;const start={...state,facts:{neighborhoods:['Núñez'],rooms:2,deliveryPreference:'can_wait'},reason:'busqueda_sin_resultados'};
 const d=await consultant({}).advanceMiaConsultative(start,'Nueva busqueda',[],sources,async()=>{calls++;return []});
 assert.equal(calls,1);assert(d.notifyAdvisor);assert(!/Mantengo las preferencias|Podemos explorar alternativas/.test(d.reply));
});
test('the customer exact two-room request in nuńez executes inventory without an invented delivery preference',async()=>{
 let calls=0;const unit={project:'Prueba Núñez',unit:'101',price:100000,currency:'USD',rooms:2,area:'55 m²',floor:'1',deliveryMonths:18,neighborhood:'Núñez',planUrls:['https://example.com/101.pdf'],down:40000,months:30,installment:2000};
 const d=await consultant({}).advanceMiaConsultative(state,'Busco 2 ambientes en nuńez',[],sources,async f=>{calls++;assert.equal(f.rooms,2);assert.equal(f.neighborhoods[0],'Núñez');assert.equal(f.deliveryMonths,undefined);assert.equal(f.deliveryPreference,undefined);return [unit]});
 assert.equal(calls,1);assert(d.reply.includes('Unidad 101'));assert.equal(d.next.stage,'unidades_presentadas');
});
test('Si after the former dead-end continuation retries the real search rather than acknowledging',async()=>{
 let calls=0;const start={...state,facts:{neighborhoods:['Núñez'],rooms:2},reason:'busqueda_sin_resultados'};
 const d=await consultant({}).advanceMiaConsultative(start,'Si',[{direction:'outbound',status:'sent',content:'Podemos explorar alternativas para acercarnos a lo que buscás 😊'}],sources,async()=>{calls++;return []});
 assert.equal(calls,1);assert(d.notifyAdvisor);assert(!/Mantengo las preferencias|Podemos explorar alternativas/.test(d.reply));
});
test('waiting after immediate delivery removes the contradictory zero deadline, preserving positive maximums',()=>{
 const context=load('lib/mia-context-facts.ts');
 const f=context.recoverMiaConversationFacts({neighborhoods:['Núñez'],rooms:2,deliveryMonths:0},[{direction:'inbound',status:'received',content:'Puedo esperar'}]);assert.equal(f.deliveryMonths,undefined);assert.equal(f.deliveryPreference,'can_wait');
 const restored=context.restoreMiaMissingFacts({...f,deliveryMonths:0},[]);assert.equal(restored.deliveryMonths,undefined);
 const bounded=context.recoverMiaConversationFacts({...f,deliveryMonths:24},[{direction:'inbound',status:'received',content:'Puedo esperar'}]);assert.equal(bounded.deliveryMonths,24);
});
test('a rejected No or greeting never re-executes inventory as a fallback',async()=>{
 for(const text of ['No','Hola','Gracias']){let calls=0;const start={...state,searchPending:true,facts:{neighborhoods:['Núñez'],rooms:2,deliveryPreference:'can_wait'}};const d=await consultant({}).advanceMiaConsultative(start,text,[],sources,async()=>{calls++;return []});assert.equal(calls,0);assert(!d.notifyAdvisor);assert(!/Mantengo las preferencias/.test(d.reply));if(text==='No')assert.equal(d.next.searchPending,false);}
});
test('Si after a recorded review acknowledges the existing request without repeating the failed search',async()=>{
 let calls=0;const start={...state,facts:{neighborhoods:['Núñez'],rooms:2},reason:'busqueda_sin_resultados',advisorRequest:{reason:'verificar_opciones',requestedAt:new Date().toISOString()}};
 const prior='Dejo al equipo la revisión de 2 ambientes en Núñez, para confirmar una propuesta con su plano y condiciones.';
 const d=await consultant({}).advanceMiaConsultative(start,'Si',[{direction:'outbound',status:'sent',content:prior}],sources,async()=>{calls++;return []});assert.equal(calls,0);assert(!d.notifyAdvisor);assert.notEqual(d.reply,prior);assert(d.reply.includes('ya quedó'));
});
