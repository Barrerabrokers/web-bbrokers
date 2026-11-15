const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
const m={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/mia-project-trial.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:id=>id==='@/lib/mia-reply-messages'?require('./load-mia-reply-messages.cjs'):id==='zod'?require('zod'):id==='@/lib/whatsapp-mia-sources-config'?{isMiaSourceUrl:url=>/^https:\/\/(docs|drive)\.google\.com\//.test(url)}:id==='@/lib/whatsapp-mia-sources'?{renderMiaQuote:q=>`${q.project} · Unidad ${q.unit}: USD ${q.price}`}:{},console,Date,process});
const api=m.exports;
function index(){return {rows:[['Edificio','Lista de Precios','Brochure'].map(value=>({value})),...api.MIA_TRIAL_PROJECTS.map(p=>[{value:p.name},{value:'Link',link:`https://docs.google.com/spreadsheets/d/${p.slug}/edit`},{value:'Link',link:`https://drive.google.com/file/d/${p.slug}/view`}])],text:'',title:'Español',url:api.MIA_TRIAL_INDEX};}
const links=api.trialProjectLinks(index());
const context={links,documents:[{id:'web:feel-recoleta',project:'Feel Recoleta',kind:'website',url:'https://barrerabrokers.com/desarrollos/feel-recoleta',text:'Feel Recoleta tiene unidades de 1, 2 y 3 ambientes en Avenida Pueyrredón 1940.'}],quotes:[{token:'[[MIA_COTIZACION:abc123]]',project:'Feel Recoleta',unit:'203',price:105900,currency:'USD'}],issues:[]};
function render(reply,evidence=[]){return api.renderMiaTrialReply(JSON.stringify({reply,evidence}),context);}
test('the selected master sheet supplies each project link and updates are followed',()=>{assert.equal(links.length,6);const t=index();t.rows[1][1].link='https://docs.google.com/spreadsheets/d/new-list/edit';assert.equal(api.trialProjectLinks(t)[0].priceList,t.rows[1][1].link);t.rows.push(t.rows[1]);assert.throws(()=>api.trialProjectLinks(t));});
test('private, unexpected and executable web content is rejected or removed',()=>{const html='<html><main><h1>Feel Recoleta</h1><p>Unidades luminosas.</p><script>SECRET()</script><p>USD 999.999</p></main></html>';const text=api.trialWebsiteText(html,'Feel Recoleta');assert.match(text,/luminosas/);assert.doesNotMatch(text,/SECRET|999/);assert.throws(()=>api.trialWebsiteText(html,'Feel Palermo'));assert.throws(()=>api.trialWebsiteText(html.replace('<main>','<main data-no-translate>'),'Feel Recoleta'));assert.throws(()=>api.trialWebsiteText(html.replace('<html>','<html><meta name="robots" content="noindex">'),'Feel Recoleta'));});
test('amounts are rendered only from an exact verified quote token',()=>{assert.match(render('Esta es una opción:\n[[MIA_COTIZACION:abc123]]'),/USD 105900/);for(const text of ['USD 999.999','Cuesta $999','[[MIA_COTIZACION:ffff]]','https://inventado.com'])assert.throws(()=>render(text));});
test('document links must come from the approved index and allowed project set',()=>{assert.equal(render('[[LINK:feel-palermo:brochure]]'),links.find(p=>p.slug==='feel-palermo').brochure);assert.throws(()=>render('[[LINK:otro-proyecto:brochure]]'));});
test('numeric facts need a real textual quote from current sources',()=>{const evidence=[{sourceId:'web:feel-recoleta',quote:'unidades de 1, 2 y 3 ambientes'}];assert.match(render('Tiene 2 ambientes.',evidence),/2/);assert.throws(()=>render('Tiene 8 ambientes.',evidence));assert.throws(()=>render('Tiene 2 ambientes.',[{sourceId:'web:feel-recoleta',quote:'pileta y gimnasio'}]));assert.throws(()=>render('Tiene 2 ambientes.',[{sourceId:'fake',quote:'2 ambientes'}]));});
test('old conversational menus and commercial knowledge are absent from the new policy',()=>{assert.match(api.MIA_TRIAL_POLICY,/No uses menús/);assert.match(api.MIA_TRIAL_POLICY,/Recordá preferencias/);assert.match(api.MIA_TRIAL_POLICY,/lista del proyecto/);assert.doesNotMatch(api.MIA_TRIAL_POLICY,/Mantengo las preferencias/);});
test('simulator denies agents and other administrators before loading sources or a model',async()=>{
 for(const [role,approved] of [['agent',true],['admin',false]]){
  const route={exports:{}};
  const mocks={'@/lib/mia-agent-search':{agentMemorySchema:require('zod').z.any()},'next/server':{NextResponse:{json:(body,opts={})=>({body,status:opts.status||200})}},'next-auth':{getServerSession:async()=>({user:{id:'tester',role}})},zod:require('zod'),'@/lib/auth':{},'@/lib/mia-reset-runtime':{isMiaTestAdministrator:async()=>approved},'@/lib/mia-project-trial':{},'@/lib/mia-meetings':{},'@/lib/mia-meeting-policy':{meetingStateSchema:require('zod').z.any()},'@/lib/mia-guidance':{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/crm/whatsapp/mia-test/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:route,exports:route.exports,require:id=>mocks[id]});
  assert.equal((await route.exports.GET()).status,403);assert.equal((await route.exports.POST({json:async()=>({})})).status,403);
 }
});

test('PDF line wrapping preserves valid evidence without accepting invented facts',()=>{
 const pdfContext={...context,documents:[{id:'brochure:alpha-place-belgrano',text:'Situado en Manuel Ugarte 1576, a metros de Avenida del Libertador y al Parque de la Inno-\nvacion.'}]};
 const reply=JSON.stringify({reply:'Está cerca del Parque de la Innovación.',evidence:[{sourceId:'brochure:alpha-place-belgrano',quote:'al Parque de la Innovación'}]});
 assert.match(api.renderMiaTrialReply(reply,pdfContext),/Innovación/);
 assert.throws(()=>api.renderMiaTrialReply(reply.replace('al Parque de la Innovación','al Parque Central'),pdfContext));
});

test('two verified units become separate messages, including adjacent tokens, with intro and closing preserved',()=>{
 const {splitMiaReplyMessages}=require('./load-mia-reply-messages.cjs');
 const c={...context,quotes:[...context.quotes,{...context.quotes[0],token:'[[MIA_COTIZACION:def456]]',unit:'305',price:120000}]};
 for(const separator of ['\n',' ']){
  const result=api.renderMiaTrialReply(JSON.stringify({reply:'Te comparto opciones:\n[[MIA_COTIZACION:abc123]]'+separator+'[[MIA_COTIZACION:def456]]\n¿Cuál preferís?',evidence:[]}),c);
  const parts=Array.from(splitMiaReplyMessages(result));
  assert.equal(parts.length,2);
  assert.match(parts[0],/Te comparto opciones/);assert.match(parts[0],/203/);assert.doesNotMatch(parts[0],/305/);
  assert.match(parts[1],/305/);assert.doesNotMatch(parts[1],/203/);assert.match(parts[1],/Cuál preferís/);
  assert(parts.every(p=>!p.includes('\f')));
 }
 assert.deepEqual(Array.from(splitMiaReplyMessages('Hola, Carolina.')),['Hola, Carolina.']);
});

test('dynamic projects use exact public names or explicit website aliases from the approved index',()=>{
 const t=index();t.rows.push([{value:'New Public Project'},{value:'Link',link:'https://docs.google.com/spreadsheets/d/new-public/edit'},{value:'Link',link:'https://drive.google.com/file/d/new-public/view'}]);
 const project={name:'New Project',websiteName:'New Public Project',slug:'new-project'};
 assert.equal(api.trialProjectLinks(t,[project])[0].priceList,'https://docs.google.com/spreadsheets/d/new-public/edit');
 assert.throws(()=>api.trialProjectLinks(t,[{...project,websiteName:'Similar Public Project'}]));
});
