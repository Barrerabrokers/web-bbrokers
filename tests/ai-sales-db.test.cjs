// Opt-in PostgreSQL integration. A disposable isolated schema; no production CRM rows.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ts=require('typescript');
const {randomUUID}=require('node:crypto');
test('database events → worker → stored score → scoped UI, with retries and idempotence',{skip:process.env.AI_SALES_DB_TEST!=='1',timeout:300000},async()=>{
 require('@next/env').loadEnvConfig(process.cwd());
 const url=process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.DATABASE_URL;
 const postgres=require('postgres');
 const schema='ai_sales_test_'+randomUUID().replaceAll('-','');
 assert.match(schema,/^ai_sales_test_[a-f0-9]{32}$/);
 const options={ssl:'require',max:1,prepare:false,onnotice:()=>{}};
 const admin=postgres(url,options);
 const sql=postgres(url,{...options,connection:{search_path:schema}});
 let calls=0,shouldFail=false;
 const semantic={summary:'Cliente de prueba solicita visita',intent:80,urgency:60,fit:null,confidence:.8,status:'VISIT_READY',reasoning:['Solicitó visita en un mensaje de prueba'],missingInformation:['Presupuesto'],confirmed:[],inferences:[],questions:[],nextAction:'Coordinar visita',suggestedMessage:'¿Qué día te queda cómodo?',preferences:Object.fromEntries(['zone','budget','country','language','purpose','bedrooms','purchaseTiming','financing'].map(k=>[k,null])),propertyMatches:[],followupHours:48};
 function load(file){
  const module={exports:{}};
  const customRequire=id=>{
   if(id==='postgres')return (url,opts)=>postgres(url,{...opts,onnotice:()=>{},connection:{search_path:schema}});
   if(id==='./model')return {...load('lib/ai-sales/model.ts'),provider:()=>({version:'test-provider',analyze:async()=>{calls++;if(shouldFail)throw Error('test');return structuredClone(semantic);}})};
   if(id.startsWith('@/'))return load(id.slice(2)+'.ts');
   if(id.startsWith('.'))return load(path.join(path.dirname(file),id+'.ts'));
   return require(id);
  };
  const source=fs.readFileSync(file,'utf8').replaceAll("public.crm_",schema+'.crm_');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:customRequire,process,console,fetch,AbortSignal});
  return module.exports;
 }
 const oldEnabled=process.env.AI_SALES_ENABLED;
 try{
  await admin.unsafe(`CREATE SCHEMA ${schema}`);
  await sql.unsafe(`CREATE TABLE agents(id UUID PRIMARY KEY,name TEXT,active BOOLEAN DEFAULT true);
   CREATE TABLE developments(id UUID PRIMARY KEY,name TEXT);
   CREATE TABLE crm_leads(id UUID PRIMARY KEY,first_name TEXT,last_name TEXT,email TEXT,country_code TEXT,phone TEXT,status TEXT,source TEXT,assigned_agent_id UUID,development_id UUID,development_name_text TEXT,notes TEXT,meta_properties JSONB DEFAULT '{}',hubspot_properties JSONB DEFAULT '{}',created_at TIMESTAMPTZ DEFAULT now(),updated_at TIMESTAMPTZ DEFAULT now());
   CREATE TABLE crm_activities(id UUID PRIMARY KEY,lead_id UUID,type TEXT,title TEXT,body TEXT,created_by UUID,external_source TEXT,external_id TEXT,scheduled_at TIMESTAMPTZ,created_at TIMESTAMPTZ DEFAULT now());
   CREATE TABLE crm_activity_results(activity_id UUID PRIMARY KEY,outcome TEXT,outcome_status TEXT,updated_at TIMESTAMPTZ DEFAULT now());
   CREATE TABLE crm_meeting_schedules(activity_id UUID PRIMARY KEY,ends_at TIMESTAMPTZ,cancelled_at TIMESTAMPTZ);
   CREATE TABLE crm_notifications(id UUID PRIMARY KEY,recipient_agent_id UUID,lead_id UUID,event_key TEXT UNIQUE,type TEXT,title TEXT,body TEXT,href TEXT);`);
  const migration=fs.readFileSync('migrations/202609_ai_sales.sql','utf8').replaceAll('public.',schema+'.').replaceAll('search_path=public','search_path='+schema);
  await sql.begin(t=>t.unsafe(migration));
  const owner=randomUUID(),other=randomUUID(),lead=randomUUID();
  await sql`INSERT INTO agents(id,name) VALUES(${owner},'Prueba owner'),(${other},'Prueba otro')`;
  await sql`INSERT INTO crm_leads(id,first_name,last_name,status,source,assigned_agent_id) VALUES(${lead},'Prueba','AI','Nuevo','test',${owner})`;
  assert.equal((await sql`SELECT event_type FROM crm_ai_events`)[0].event_type,'lead_created');
  process.env.AI_SALES_ENABLED='true';
  const {processSales:rawProcessSales}=load('lib/ai-sales/worker.ts');
  const processSales=async(options)=>{await sql`UPDATE crm_ai_control SET next_model_at=now()-interval '1 minute' WHERE id=1`;return rawProcessSales(options);};
  const first=await processSales();assert.equal(first.processed,1);assert.equal(calls,1);
  assert.equal((await processSales()).processed,0);assert.equal(calls,1);
  const {readSales}=load('lib/ai-sales/store.ts');
  const view=await readSales({id:owner,all:false});assert.equal(view.leads.length,1);assert.equal(view.recommendations.length,1);assert.equal(view.total,1);
  assert.equal((await readSales({id:other,all:false})).leads.length,0);
  assert.equal((await readSales({id:other,all:false},lead)).leads.length,0);
  assert.equal((await readSales({id:other,all:true})).leads.length,1);
  await sql`UPDATE crm_ai_recommendations SET status='snoozed',snoozed_until=now()+interval '1 day' WHERE lead_id=${lead}`;
  assert.equal((await readSales({id:owner,all:false})).total,0);
  assert.equal((await readSales({id:owner,all:false},lead)).leads.length,1);
  await sql`UPDATE crm_ai_recommendations SET status='completed' WHERE lead_id=${lead}`;
  assert.equal((await readSales({id:owner,all:false})).total,0);
  const message=randomUUID();
  await sql`INSERT INTO crm_activities(id,lead_id,type,title,body,external_source) VALUES(${message},${lead},'whatsapp','WhatsApp recibido','Quiero visitar','whatsapp_inbound')`;
  await processSales();assert.equal((await sql`SELECT ai_status FROM crm_ai_state`)[0].ai_status,'WAITING_AGENT');
  assert.equal((await sql`SELECT COUNT(*)::int AS n FROM crm_notifications WHERE recipient_agent_id=${owner}`)[0].n,1);
  assert.equal((await sql`SELECT COUNT(*)::int AS n FROM crm_ai_recommendations WHERE status='pending'`)[0].n,1);
  await sql`UPDATE crm_ai_state SET next_review_at=now()-interval '1 minute'`;
  const before=calls;await processSales();assert.equal(calls,before);
  // Provider failure leaves previous state intact and event pending for retry.
  shouldFail=true;await sql`UPDATE crm_leads SET notes='Nueva nota' WHERE id=${lead}`;
  assert.equal((await processSales()).failed,1);
  assert.equal((await sql`SELECT ai_status FROM crm_ai_state`)[0].ai_status,'WAITING_AGENT');
  assert.equal((await sql`SELECT COUNT(*)::int AS n FROM crm_ai_events WHERE processed_at IS NULL`)[0].n,1);
  shouldFail=false;await sql`UPDATE crm_ai_state SET retry_at=NULL`;
  await sql`UPDATE crm_leads SET status='Vendido' WHERE id=${lead}`;
  await processSales();assert.equal((await sql`SELECT ai_status FROM crm_ai_state`)[0].ai_status,'CLOSED_WON');
  assert.equal((await sql`SELECT COUNT(*)::int AS n FROM crm_ai_recommendations WHERE status='pending'`)[0].n,0);
  assert.ok((await sql`SELECT COUNT(*)::int AS n FROM crm_ai_history WHERE status='CLOSED_WON'`)[0].n>0);
  // Re-running migration never duplicates backfill events.
  await sql.begin(t=>t.unsafe(migration));await sql.begin(t=>t.unsafe(migration));
  assert.equal((await sql`SELECT COUNT(*)::int AS n FROM crm_ai_events WHERE source='initial_backfill'`)[0].n,1);
  // Historical backfill remains newest-first; live interactions outrank it.
  const older=randomUUID(),newer=randomUUID();
  await sql`INSERT INTO crm_leads(id,first_name,status,source,assigned_agent_id,created_at) VALUES
    (${older},'Older','Nuevo','test',${owner},now()-interval '30 days'),
    (${newer},'Newer','Nuevo','test',${owner},now())`;
  await sql`UPDATE crm_ai_events SET source='initial_backfill' WHERE lead_id IN (${older},${newer})`;
  assert.equal((await processSales()).processed,1);
  assert.ok((await sql`SELECT last_analyzed_at FROM crm_ai_state WHERE lead_id=${newer}`)[0].last_analyzed_at);
  assert.equal((await sql`SELECT last_analyzed_at FROM crm_ai_state WHERE lead_id=${older}`)[0].last_analyzed_at,null);
  const ordered=await readSales({id:owner,all:false});
  assert.equal(ordered.leads[0].id,newer);assert.equal(ordered.leads[1].id,older);
  await sql`INSERT INTO crm_activities(id,lead_id,type,title,body) VALUES(${randomUUID()},${older},'llamada','Llamada finalizada','Quiere visitar mañana')`;
  assert.equal((await rawProcessSales({liveOnly:true})).processed,0); // shared provider cooldown
  assert.equal((await processSales({liveOnly:true})).processed,1);
  assert.ok((await sql`SELECT last_analyzed_at FROM crm_ai_state WHERE lead_id=${older}`)[0].last_analyzed_at);
  // Pipeline priority overrides creation/event order, including canonical and plural spellings.
  const interested=randomUUID(),inProgress=randomUUID(),contacted=randomUUID(),plural=randomUUID();
  await sql`INSERT INTO crm_leads(id,first_name,status,source,assigned_agent_id,created_at) VALUES
    (${contacted},'Contacted','Contactado','test',${owner},now()),
    (${inProgress},'In progress',' En Curso ','test',${owner},now()-interval '10 days'),
    (${interested},'Interested','Interesado','test',${owner},now()-interval '60 days'),
    (${plural},'Interested plural','Interesados','test',${owner},now()-interval '90 days')`;
  const prioritized=await readSales({id:owner,all:false});
  assert.deepEqual(Array.from(prioritized.leads.filter(l=>[interested,plural,inProgress,contacted].includes(l.id)),l=>l.id),[interested,plural,inProgress,contacted]);
  assert.equal((await processSales({liveOnly:true})).processed,1);
  assert.ok((await sql`SELECT last_analyzed_at FROM crm_ai_state WHERE lead_id=${plural}`)[0].last_analyzed_at);
  assert.equal((await sql`SELECT last_analyzed_at FROM crm_ai_state WHERE lead_id=${interested}`)[0].last_analyzed_at,null);
  assert.equal((await sql`SELECT last_analyzed_at FROM crm_ai_state WHERE lead_id=${inProgress}`)[0].last_analyzed_at,null);
  // Higher score outranks pipeline; equal scores retain pipeline and date ordering.
  await sql`UPDATE crm_ai_state SET ai_score=0`;
  await sql`UPDATE crm_ai_state SET ai_score=CASE WHEN lead_id=${contacted} THEN 95 ELSE 90 END,
    last_analyzed_at=now() WHERE lead_id IN (${contacted},${interested},${inProgress})`;
  const {filtersSchema}=load('lib/ai-sales/store.ts');
  const scored=await readSales({id:owner,all:false},undefined,filtersSchema.parse({category:'hot'}));
  assert.deepEqual(Array.from(scored.leads,l=>l.id),[contacted,interested,inProgress]);
 }finally{
  if(oldEnabled===undefined)delete process.env.AI_SALES_ENABLED;else process.env.AI_SALES_ENABLED=oldEnabled;
  await sql.end();await admin.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end();
 }
});
