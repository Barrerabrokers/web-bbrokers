// Opt-in PostgreSQL integration. A disposable isolated schema; no production CRM rows.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ts=require('typescript');
const {randomUUID}=require('node:crypto');
test('completed in-person and virtual outcomes → worker, edits, future/cancelled exclusion and backfill',{skip:process.env.AI_SALES_DB_TEST!=='1',timeout:300000},async()=>{
 require('@next/env').loadEnvConfig(process.cwd());
 const url=process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.DATABASE_URL;
 const postgres=require('postgres');
 const schema='ai_sales_test_'+randomUUID().replaceAll('-','');
 assert.match(schema,/^ai_sales_test_[a-f0-9]{32}$/);
 const options={ssl:'require',max:1,prepare:false,connect_timeout:10,onnotice:()=>{}};
 const admin=postgres(url,options);
 const sql=postgres(url,{...options,connection:{search_path:schema}});
 let calls=0,shouldFail=false,lastContext;
 const semantic={summary:'Cliente de prueba solicita visita',intent:80,urgency:60,fit:null,confidence:.8,status:'VISIT_READY',reasoning:['Solicitó visita en un mensaje de prueba'],missingInformation:['Presupuesto'],confirmed:[],inferences:[],questions:[],nextAction:'Coordinar visita',suggestedMessage:'¿Qué día te queda cómodo?',preferences:Object.fromEntries(['zone','budget','country','language','purpose','bedrooms','purchaseTiming','financing'].map(k=>[k,null])),propertyMatches:[],followupHours:48};
 function load(file){
  const module={exports:{}};
  const customRequire=id=>{
   if(id==='postgres')return (url,opts)=>postgres(url,{...opts,onnotice:()=>{},connection:{search_path:schema}});
   if(id==='./model')return {...load('lib/ai-sales/model.ts'),provider:()=>({version:'test-provider',analyze:async(context)=>{lastContext=context;calls++;if(shouldFail)throw Error('test');return structuredClone(semantic);}})};
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
  const owner=randomUUID();
  await sql`INSERT INTO agents(id,name) VALUES(${owner},'Prueba agente')`;
  process.env.AI_SALES_ENABLED='true';
  const {processSales}=load('lib/ai-sales/worker.ts');
  const run=async()=>{await sql`UPDATE crm_ai_control SET next_model_at=now()-interval '1 minute' WHERE id=1`;return processSales();};
  for(const title of ['Reunión presencial','Reunión virtual']){
   const lead=randomUUID(),meeting=randomUUID();
   await sql`INSERT INTO crm_leads(id,first_name,status,source,assigned_agent_id) VALUES(${lead},'Prueba','En curso','test',${owner})`;
   await sql`INSERT INTO crm_activities(id,lead_id,type,title,body,scheduled_at) VALUES(${meeting},${lead},'reunion',${title},'Contexto de la reunión',now()-interval '2 days')`;
   await sql`INSERT INTO crm_activity_results(activity_id,outcome,outcome_status) VALUES(${meeting},'Quiere dos unidades; enviar propuesta el viernes','completed')`;
   assert.equal((await run()).processed,1);
   assert.equal(lastContext.meetingHistory[0].outcome,'Quiere dos unidades; enviar propuesta el viernes');
   assert.equal(lastContext.meetingHistory[0].id,meeting);
   const state=(await sql`SELECT * FROM crm_ai_state WHERE lead_id=${lead}`)[0];
   assert.equal(state.analysis.signals.completedVisit,true);
   await sql`UPDATE crm_activity_results SET outcome='Cambio de decisión: esperar financiación',updated_at=now() WHERE activity_id=${meeting}`;
   assert.equal((await run()).processed,1);
   assert.equal(lastContext.meetingHistory[0].outcome,'Cambio de decisión: esperar financiación');
  }
  for(const [status,outcomeStatus,date] of [['En curso','cancelled','2026-01-01'],['En curso','completed','2099-01-01'],['Vendido','completed','2026-01-01'],['No interesado / no califica','completed','2026-01-01']]){
   const lead=randomUUID(),meeting=randomUUID();
   await sql`INSERT INTO crm_leads(id,first_name,status,source,assigned_agent_id) VALUES(${lead},'Prueba',${status},'test',${owner})`;
   await sql`INSERT INTO crm_activities(id,lead_id,type,title,scheduled_at) VALUES(${meeting},${lead},'reunion','Reunión virtual',${date})`;
   await sql`INSERT INTO crm_activity_results(activity_id,outcome,outcome_status) VALUES(${meeting},'Resultado de prueba',${outcomeStatus})`;
  }
  assert.equal((await run()).processed,0);
  const queued=randomUUID(),meeting=randomUUID();
  await sql`INSERT INTO crm_leads(id,first_name,status,source,assigned_agent_id) VALUES(${queued},'Prueba','Reunion','test',${owner})`;
  await sql`INSERT INTO crm_activities(id,lead_id,type,title,scheduled_at) VALUES(${meeting},${queued},'reunion','Reunión virtual','2099-01-01')`;
  assert.equal((await run()).processed,1);
  assert.equal(lastContext.signals.completedVisit,false);
  const backfill=fs.readFileSync('migrations/20261003_ai_sales_meeting_results.sql','utf8');
  await sql.begin(t=>t.unsafe(backfill));await sql.begin(t=>t.unsafe(backfill));
  assert.equal((await sql`SELECT COUNT(*)::int AS n FROM crm_ai_events WHERE dedupe_key LIKE 'meeting-results-v4:%'`)[0].n,2);
 }finally{
  if(oldEnabled===undefined)delete process.env.AI_SALES_ENABLED;else process.env.AI_SALES_ENABLED=oldEnabled;
  await sql.end();await admin.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end();
 }
});
