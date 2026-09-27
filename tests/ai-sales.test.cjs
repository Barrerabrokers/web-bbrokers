const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ts=require('typescript');
function load(file,overrides={}){
 const module={exports:{}};
 const customRequire=id=>id.startsWith('.')?load(path.join(path.dirname(file),id+'.ts')):require(id);
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,require:customRequire,process,console,fetch,AbortSignal,Buffer,...overrides});
 return module.exports;
}
const {calculateScore,analysisSchema}=load('lib/ai-sales/model.ts');
const now=Date.parse('2026-09-22T15:00:00Z');
const analysis={summary:'Consulta por Palermo',intent:80,urgency:65,fit:null,confidence:.8,status:'ACTIVE',reasoning:['Pidió coordinar una visita'],missingInformation:['Forma de pago'],confirmed:[],inferences:[],questions:[],nextAction:'Coordinar visita',suggestedMessage:'¿Qué día te queda cómodo?',preferences:Object.fromEntries(['zone','budget','country','language','purpose','bedrooms','purchaseTiming','financing'].map(k=>[k,null])),propertyMatches:[],followupHours:48};
const signals={lastInbound:'2026-09-22T10:00:00Z',lastOutbound:'2026-09-21T10:00:00Z',lastContact:'2026-09-22T10:00:00Z',inboundCount:2,clicks:0,opens:0,createdAt:'2026-09-01T10:00:00Z',pipeline:'En curso',completedVisit:false};
test('provider context is valid bounded JSON even with large external payloads',()=>{
 const {compactSalesContext}=load('lib/ai-sales/provider-format.ts');
 const body='Información del cliente '.repeat(10000);
 for(const compactRetry of [false,true]){
  const packed=compactSalesContext({compactRetry,lead:{notes:body,forms:body},callHistory:{count:3},events:Array.from({length:100},(_,id)=>({id:String(id),type:'activity_updated',data:{body}}))});
  assert.ok(Buffer.byteLength(packed)<= (compactRetry?7000:11000));
  const result=JSON.parse(packed);assert.equal(result.callHistory.count,3);assert.equal(result.contextTruncated,true);
 }
 assert.doesNotThrow(()=>compactSalesContext(null));
});
test('structured analysis rejects invented status, invalid scores and missing fields',()=>{
 assert.equal(analysisSchema.safeParse(analysis).success,true);
 for(const value of [{...analysis,intent:101},{...analysis,status:'RESERVED'},{...analysis,confidence:2},{}])assert.equal(analysisSchema.safeParse(value).success,false);
});
test('unanswered high-intent inbound escalates, an agent reply clears it',()=>{
 const a=calculateScore(analysis,signals,now);assert.equal(a.status,'WAITING_AGENT');assert.equal(a.alert,'CRITICAL');
 const b=calculateScore(analysis,{...signals,lastOutbound:'2026-09-22T14:00:00Z'},now);assert.equal(b.waiting,false);assert.equal(b.status,'ACTIVE');
});
test('specific coaching action is retained for unanswered messages and completed visits',()=>{
 const nextAction='Responder por WhatsApp la consulta y proponer coordinar una visita';
 assert.equal(calculateScore({...analysis,nextAction},signals,now).nextAction,nextAction);
 assert.equal(calculateScore({...analysis,nextAction},{...signals,completedVisit:true},now).nextAction,nextAction);
});
test('coaching uses existing contact data, complete call history and channel-specific CTA',()=>{
 const {specialistInstructions}=load('lib/ai-sales/agents.ts');
 for(const rule of ['callHistory.count','No vuelvas a preguntar presupuesto','asunto y cuerpo','un único llamado a la acción','pedido de no contacto'])assert.ok(specialistInstructions.includes(rule));
 const worker=fs.readFileSync('lib/ai-sales/worker.ts','utf8');
 assert.match(worker,/COUNT\(\*\)::int AS count FROM crm_activities WHERE lead_id=\$\{lead.id\} AND type='llamada'/);
 assert.match(worker,/job.model_version===ai.version/);
 const {canViewAllCrmContacts}=load('lib/roles.ts');
 assert.equal(canViewAllCrmContacts('admin'),true);
 for(const role of ['agent','marketing',null])assert.equal(canViewAllCrmContacts(role),false);
});
test('email opens are capped and cannot dominate engagement',()=>{
 const base=calculateScore(analysis,signals,now);
 const opened=calculateScore(analysis,{...signals,opens:1000},now);
 assert.ok(opened.score-base.score<=1);
 assert.equal(opened.dimensions.engagement,32);
 assert.equal(calculateScore(analysis,{...signals,opens:1},now).score,opened.score);
});
test('only confirmed CRM pipeline can close a lead',()=>{
 assert.notEqual(calculateScore({...analysis,status:'CLOSED_WON'},signals,now).status,'CLOSED_WON');
 assert.equal(calculateScore(analysis,{...signals,pipeline:'Vendido'},now).status,'CLOSED_WON');
 assert.equal(calculateScore(analysis,{...signals,pipeline:'Perdido'},now).score,0);
});
test('scores stay bounded and unknown fit remains explicitly unknown',()=>{
 for(const intent of [0,25,50,100])for(const fit of [null,0,100]){
  const result=calculateScore({...analysis,intent,fit},{...signals,inboundCount:100,clicks:100,opens:100},now);
  assert.ok(result.score>=0&&result.score<=100);assert.equal(result.dimensions.fit,fit);
 }
});
test('visit follow-up anchors to completed visit, not old last contact',()=>{
 const result=calculateScore(analysis,{...signals,lastInbound:null,completedVisit:true,visitAt:'2026-09-22T12:00:00Z'},now);
 assert.equal(result.due,'2026-09-23T00:00:00.000Z');assert.equal(result.visitFollowup,true);
});
test('stale high-intent lead has context-sensitive risk; low intent does not',()=>{
 const stale={...signals,lastInbound:null,lastContact:'2026-09-10T10:00:00Z'};
 assert.equal(calculateScore(analysis,stale,now).risk,true);
 assert.equal(calculateScore({...analysis,intent:20},stale,now).risk,false);
 assert.equal(calculateScore(analysis,stale,now).reactivate,true);
 assert.equal(calculateScore({...analysis,followupHours:720},stale,now).risk,false);
 assert.equal(calculateScore({...analysis,followupHours:720},stale,now).reactivate,false);
});
test('worker is event-driven, bounded, leased and has no delivery capability',()=>{
 const source=fs.readFileSync('lib/ai-sales/worker.ts','utf8');
 for(const rule of ['FOR UPDATE OF s SKIP LOCKED','LEASE_LOST','AI_SALES_DAILY_LIMIT','LIMIT 12','processed_at=now()'])assert.ok(source.includes(rule));
 assert.doesNotMatch(source,/sendMail|sendWhatsapp|sendWhatsApp|UPDATE crm_leads|DELETE FROM crm_activities/);
 const ui=fs.readFileSync('components/admin/ai-sales.tsx','utf8');assert.doesNotMatch(ui,/groq.com|GROQ_API_KEY/);
});
test('list orders by known score then pipeline; worker retains pipeline priority',()=>{
 assert.match(fs.readFileSync('lib/ai-sales/store.ts','utf8'),/ORDER BY CASE WHEN s.last_analyzed_at IS NOT NULL THEN s.ai_score END DESC NULLS LAST,\s+\$\{salesPipelinePriority\(sql\)\},l.created_at DESC NULLS LAST,l.id DESC/);
 assert.match(fs.readFileSync('lib/ai-sales/worker.ts','utf8'),/\$\{salesPipelinePriority\(sql\)\}/);
 assert.match(fs.readFileSync('lib/ai-sales/worker.ts','utf8'),/l.created_at DESC NULLS LAST,l.id DESC/);
 const ui=fs.readFileSync('components/admin/ai-sales.tsx','utf8');
 assert.match(ui,/<details open=\{expandDetails \|\| undefined\} className="group mt-2 text-sm"><summary/);
 assert.ok(ui.indexOf('Detalles<span')<ui.indexOf('{l.last_error&&'));
 for(const color of ['red','orange','amber','blue','slate'])assert.ok(ui.includes(`bg-${color}-100`));
});
test('contact AI report is at the bottom, lazy and closed until requested',()=>{
 const page=fs.readFileSync('app/admin/crm/[id]/page.tsx','utf8');
 const report=fs.readFileSync('components/admin/ai-sales-report.tsx','utf8');
 assert.ok(page.indexOf('<AiSalesReport key=')>page.indexOf('<DevelopmentPanel name='));
 assert.match(page,/<AiSalesReportButton leadId=\{activity.leadId\}/);
 assert.match(page,/<AiSalesReportButton leadId=\{lead.id\}/);
 assert.match(report,/useState\(false\)/);
 assert.match(report,/open && <AiSales/);
 assert.match(report,/aria-expanded=\{open\}/);
 assert.match(report,/removeEventListener\(openEvent, show\)/);
 assert.doesNotMatch(report,/fetch\(|reanalyze/);
});
test('read and write endpoints preserve ownership and filter validation',()=>{
 const {filtersSchema}=load('lib/ai-sales/store.ts');
 assert.equal(filtersSchema.safeParse({score:101}).success,false);
 assert.equal(filtersSchema.safeParse({page:-1}).success,false);
 assert.equal(filtersSchema.safeParse({category:'waiting',score:80,page:2}).success,true);
 const source=fs.readFileSync('app/api/crm/ai-sales/route.ts','utf8');
 assert.match(source,/assigned_agent_id=\$\{user.id\}/);assert.match(source,/canViewAllCrmContacts/);
});
test('provider quota errors expose only safe codes and preserve retry-after',async()=>{
 const prior=process.env.GROQ_API_KEY;process.env.GROQ_API_KEY='test-not-a-real-key';
 try{
  const m=load('lib/ai-sales/model.ts',{fetch:async()=>({ok:false,status:429,headers:new Headers({'retry-after':'120'}),json:async()=>({error:{code:'rate_limit_exceeded',message:'PRIVATE DATA MUST NOT BE LOGGED'}})})});
  await assert.rejects(m.provider().analyze({}),error=>{
   assert.equal(error.status,429);assert.equal(error.retrySeconds,120);
   assert.equal(error.message,'AI_PROVIDER_429_rate_limit_exceeded');return true;
  });
 }finally{if(prior===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=prior;}
});
