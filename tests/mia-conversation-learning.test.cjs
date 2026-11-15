const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:id=>mocks[id]||(id.startsWith('@/')?load(id.slice(2)+'.ts',mocks):require(id)),console,Date,process,Set,Map});return module.exports;}
const search=load('lib/mia-agent-search.ts'),learning=load('lib/mia-conversation-learning.ts');
const project={name:'9 de Julio Estudios 3',slug:'9-de-julio-estudios-3',status:'finalizado',neighborhood:'San Telmo'};
const unit=u=>({project:project.name,unit:u,key:search.agentQuoteKey({project:project.name,unit:u})});
const messages=[{direction:'outbound',content:project.name+' · Unidad 1A\nPrecio de lista: USD 102300'},{direction:'outbound',content:project.name+' · Unidad 3A\nPrecio de lista: USD 109100'}];
test('delivered references are recovered after a manual answer without learning old assistant prices',()=>{
 const memory=learning.restoreMiaReferences(search.emptyAgentMemory(),messages,[project]);
 assert.equal(memory.lastOffered.length,2);assert.equal(learning.miaFollowup('3 A',memory).selected.unit,'3A');
 assert.equal(memory.preferences.total,null);
 assert.equal(learning.restoreMiaReferences(search.emptyAgentMemory(),[{direction:'inbound',content:messages[0].content}],[project]).lastOffered.length,0);
});
test('selection persists for financing, floor plans and reservation instead of restarting qualification',()=>{
 const memory={...search.emptyAgentMemory(),lastOffered:[unit('1A'),unit('3A')],selectedUnit:unit('3A')};
 for(const [text,intent] of [['cuantas cuotas se pueden hacer','financing'],['Mandame el plano','documents'],['Quiero reservar esa unidad','reservation']]){const turn=learning.miaFollowup(text,memory);assert.equal(turn.intent,intent);assert.equal(turn.selected.unit,'3A');}
 assert.notEqual(learning.miaFollowup('No quiero reservar',memory).intent,'reservation');
});
test('new confirmed preferences survive model omissions and an explicit fresh search clears them',()=>{
 const memory={...search.emptyAgentMemory(),priority:'monthly',preferences:search.agentPreferencesSchema.parse({purpose:'investment',down:{amount:50000,currency:'USD'}})};
 const plan=search.agentPlanSchema.parse({intent:'details',preferences:search.agentPreferencesSchema.parse({}),reset:false,more:false,selected:null,unclearBudget:false});
 const kept=learning.preserveMiaPreferences(plan,memory,'Qué amenities tiene');assert.equal(kept.preferences.purpose,'investment');assert.equal(kept.preferences.down.amount,50000);assert.equal(kept.priority,'monthly');
 assert.equal(learning.preserveMiaPreferences({...plan,reset:true},memory,'Nueva búsqueda').preferences.down,null);
});
test('unverified answers become bounded, per-client questions rather than global commercial facts',()=>{
 let memory=search.emptyAgentMemory();for(let i=0;i<30;i++)memory.pendingQuestions=learning.learnMiaQuestion(memory,'Consulta '+i,'Confirmar con el equipo');
 assert.equal(memory.pendingQuestions.length,20);memory.pendingQuestions=learning.learnMiaQuestion(memory,'Consulta 29','Nueva aclaración');assert.equal(memory.pendingQuestions.length,20);assert.equal(memory.pendingQuestions.at(-1).reason,'Nueva aclaración');
});
function agent(memory,{plans=false,financing=false}={}){
 const quote={project:project.name,unit:'3A',currency:'USD',area:41.8,price:109100,token:'[[MIA_COTIZACION:abc]]',...(financing?{down:40000,months:24,installment:2000}:{})};
 return load('lib/mia-agent.ts',{
  '@/lib/whatsapp-ai-provider':{generateGroqCustomerReply:async()=>{throw Error('Follow-up should not need reinterpretation');}},
  '@/lib/mia-agent-memory':{},'@/lib/whatsapp-sales-catalog':{salesDocumentExcerpt:s=>s},
  '@/lib/mia-unit-plans':{readMiaUnitPlan:async()=>{if(!plans)throw Error('No verified floor plan');return Buffer.from('verified');}},
  '@/lib/mia-project-trial':{MIA_TRIAL_POLICY:'Policy',loadMiaPublicCatalog:async()=>[project],loadMiaTrialContext:async()=>({documents:[{id:'web:'+project.slug,project:project.name,text:'Publicado'}],quotes:[quote],links:[{...project,brochure:'https://drive.google.com/example'}],issues:[]}),renderMiaTrialReply:raw=>JSON.parse(raw).reply},
 });
}
test('Lucas sequence: 3 A → reservation → installments keeps the same unit and records missing terms',async()=>{
 let memory=search.emptyAgentMemory(),dialogue=[...messages];
 for(const [text,pattern] of [['3 A',/seguimos con la unidad 3A/],['Quiero reservar esa unidad',/Todavía no hay una reserva confirmada/],['cuantas cuotas se pueden hacer',/no detalla un plan de financiación/]]){
  dialogue.push({direction:'inbound',content:text});const result=await agent(memory).runMiaAgent(dialogue,{enabled:true},'',{memory});memory=result.memory;
  assert.match(result.reply,pattern);assert.doesNotMatch(result.reply,/vivir o.*invertir|qué tipo de unidad/);assert.equal(memory.selectedUnit.unit,'3A');dialogue.push({direction:'outbound',content:result.reply});
 }
 assert.equal(memory.pendingQuestions.length,2);
});
test('verified floor plan and financing answer the selected unit directly',async()=>{
 const memory={...search.emptyAgentMemory(),lastOffered:[unit('1A'),unit('3A')],selectedUnit:unit('3A')};
 const plan=await agent(memory,{plans:true}).runMiaAgent([...messages,{direction:'inbound',content:'Mandame el plano'}],{enabled:true},'',{memory});assert.match(plan.reply,/mia-unit-plan.*unit=3A/);
 const terms=await agent(memory,{financing:true}).runMiaAgent([...messages,{direction:'inbound',content:'Cuantas cuotas'}],{enabled:true},'',{memory});assert.match(terms.reply,/MIA_COTIZACION/);assert.equal(terms.memory.pendingQuestions.length,0);
});
test('new searches and corrected budgets are interpreted instead of being mistaken for old-unit financing',()=>{
 const memory={...search.emptyAgentMemory(),lastOffered:[unit('1A'),unit('3A')],selectedUnit:unit('3A')};
 for(const text of ['Busco dos ambientes en Núñez con cuotas','Tengo 50000 dólares de anticipo','Ahora quiero otra opción con financiación'])assert.equal(learning.miaFollowup(text,memory).intent,null);
 const other={name:'Feel Palermo',slug:'feel-palermo'};assert.equal(learning.miaFollowup('Qué financiación tiene Feel Palermo',memory,[project,other]).intent,null);
});
test('explicit purpose is learned even when the model forgets it, with corrections in customer order',()=>{
 const memory=search.emptyAgentMemory();const plan=search.agentPlanSchema.parse({intent:'search',preferences:search.agentPreferencesSchema.parse({}),reset:false,more:false,selected:null,unclearBudget:false});
 assert.equal(learning.preserveMiaPreferences(plan,memory,'Busco dos ambientes para vivir').preferences.purpose,'living');
 assert.equal(learning.preserveMiaPreferences(plan,memory,'No es para vivir, es para invertir').preferences.purpose,'investment');
 assert.equal(learning.preserveMiaPreferences(plan,memory,'No es para vivir').preferences.purpose,null);
});
test('named units inside a follow-up are respected, including unknown identifiers',()=>{
 const memory={...search.emptyAgentMemory(),lastOffered:[unit('1A'),unit('3A')],selectedUnit:unit('1A')};
 const turn=learning.miaFollowup('Quiero reservar la 3 A',memory);assert.equal(turn.intent,'reservation');assert.equal(turn.selected.unit,'3A');assert.equal(turn.selectionOnly,false);
 assert.equal(learning.miaFollowup('Mandame el plano de la 9A',memory).intent,null);
 assert.equal(learning.miaFollowup('Y qué amenities tiene?',memory).selected.unit,'1A');assert.equal(learning.miaFollowup('Y qué amenities tiene?',memory).intent,'details');
});
test('surface priorities and plan verification use numeric areas from actual sheet strings',()=>{
 assert.equal(search.miaQuoteArea('41,8 m² (Superficie propia)'),41.8);assert.equal(search.miaQuoteArea('sin dato'),undefined);
 const prefs=search.agentPreferencesSchema.parse({});
 const rows=[{project:'A',unit:'101',currency:'USD',price:100,area:'35 m² (Total m²)'},{project:'A',unit:'102',currency:'USD',price:200,area:'78 m² (Propia/Unidad m²)'}];
 assert.equal(search.searchAgentQuotes(rows,prefs,[],'space')[0].unit,'102');
});

test('model omissions preserve known rooms, zone, project and delivery; explicit zone corrections clear the old project',()=>{
 const memory=search.emptyAgentMemory();memory.preferences={...memory.preferences,rooms:[2],neighborhoods:['Palermo'],projects:['Feel Palermo'],delivery:'construction',purpose:'investment',financing:true};
 const plan={intent:'search',preferences:search.agentPreferencesSchema.parse({}),reset:false,more:false,selected:null,unclearBudget:false,priority:null};
 const kept=learning.preserveMiaPreferences(plan,memory,'Dale');assert.deepEqual(Array.from(kept.preferences.rooms),[2]);assert.deepEqual(Array.from(kept.preferences.neighborhoods),['Palermo']);assert.deepEqual(Array.from(kept.preferences.projects),['Feel Palermo']);assert.equal(kept.preferences.delivery,'construction');assert.equal(kept.preferences.purpose,'investment');assert.equal(kept.preferences.financing,true);
 const corrected=learning.preserveMiaPreferences({...plan,preferences:{...plan.preferences,neighborhoods:['Núñez'],rooms:[3]}},memory,'Ahora tres ambientes en Núñez');assert.deepEqual(Array.from(corrected.preferences.projects),[]);assert.deepEqual(Array.from(corrected.preferences.rooms),[3]);assert.deepEqual(Array.from(corrected.preferences.neighborhoods),['Núñez']);
});
