const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
require('../work/mia-web-test/load-ts.cjs');
const {dashboardScope}=require('../lib/crm-agent-dashboard.ts');
const A='00000000-0000-0000-0000-000000000001',B='00000000-0000-0000-0000-000000000002';
test('dashboard defaults to own scope even for administrators',()=>{
 assert.equal(dashboardScope({id:A,role:'admin'}),A);
 assert.equal(dashboardScope({id:A,role:'admin'},B),B);
 assert.equal(dashboardScope({id:A,role:'admin'},'all'),null);
 for(const role of ['agent','marketing']){
  assert.equal(dashboardScope({id:A,role}),A);
  assert.throws(()=>dashboardScope({id:A,role},B));
  assert.throws(()=>dashboardScope({id:A,role},'all'));
 }
 assert.throws(()=>dashboardScope({id:A,role:'visitor'}));
});
test('dashboard API enforces session, role, owner and filters before reading data',async()=>{
 const ts=require('typescript'),Module=require('node:module');let actor=null,calls=[];
 const mod=new Module('dashboard-api');
 const source=ts.transpileModule(fs.readFileSync('app/api/crm/agent-dashboard/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 mod.require=id=>{
  if(id==='next-auth')return {getServerSession:async()=>actor?{user:actor}:null};
  if(id==='@/lib/auth')return {authOptions:{}};
  if(id==='@/lib/crm-agent-dashboard-db')return {getAgentDashboard:async(...args)=>{calls.push(args);return {scope:args[0]};}};
  if(id==='@/lib/crm-agent-dashboard')return {dashboardScope};
  if(id.startsWith('@/'))return require('../'+id.slice(2)+'.ts');
  return require(id);
 };
 mod._compile(source,'dashboard-api.cjs');
 const {NextRequest}=require('next/server');
 const get=search=>mod.exports.GET(new NextRequest('https://example.test/api/crm/agent-dashboard'+search));
 assert.equal((await get('')).status,403);
 actor={id:A,role:'agent'};assert.equal((await get('?agent='+B)).status,403);assert.equal((await get('?agent=all')).status,403);
 assert.equal((await get('?agent=invalid')).status,400);assert.equal((await get('?status=invalid')).status,400);assert.equal(calls.length,0);
 let response=await get('');assert.equal(response.status,200);assert.equal((await response.json()).scope,A);assert.equal(response.headers.get('Cache-Control'),'private, no-store, max-age=0');
 actor={id:A,role:'admin'};response=await get('');assert.equal((await response.json()).scope,A);
 response=await get('?agent=all');assert.equal((await response.json()).scope,null);
 response=await get('?agent='+B);assert.equal((await response.json()).scope,B);
 actor={id:A,role:'visitor'};assert.equal((await get('')).status,403);
});
test('portfolio snapshot isolates ownership, meetings, dates and terminal stages',{skip:process.env.RUN_DB_TESTS!=='1'},async()=>{
 require('@next/env').loadEnvConfig(process.cwd());const postgres=require('postgres');
 const sql=postgres(process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.DATABASE_URL,{ssl:'require',max:1,prepare:false});
 const query=fs.readFileSync('lib/crm-agent-dashboard-db.ts','utf8').match(/AGENT_DASHBOARD_SQL = `([\s\S]*?)`;/)[1];
 const L='00000000-0000-0000-0000-000000000011',M='00000000-0000-0000-0000-000000000012';let n=100;
 const uuid=()=>`00000000-0000-0000-0000-${String(n++).padStart(12,'0')}`;
 try{await sql.begin(async tx=>{
  await tx.unsafe(`CREATE TEMP TABLE agents(id uuid,name text) ON COMMIT DROP;
   CREATE TEMP TABLE developments(id uuid,name text) ON COMMIT DROP;
   CREATE TEMP TABLE crm_leads(id uuid,first_name text,last_name text,email text,status text,temperature text,assigned_agent_id uuid,development_name_text text,development_id uuid,created_at timestamptz) ON COMMIT DROP;
   CREATE TEMP TABLE crm_activities(id uuid,lead_id uuid,created_by uuid,type text,title text,scheduled_at timestamptz,created_at timestamptz,external_id text) ON COMMIT DROP;
   CREATE TEMP TABLE crm_meeting_schedules(activity_id uuid,calendar_agent_id uuid,cancelled_at timestamptz) ON COMMIT DROP;
   CREATE TEMP TABLE crm_activity_results(activity_id uuid,outcome text,outcome_status text,updated_at timestamptz) ON COMMIT DROP;
   CREATE TEMP TABLE crm_meeting_bookings(id uuid,agent_id uuid,guest_name text,guest_email text,starts_at timestamptz,google_event_id text) ON COMMIT DROP;`);
  await tx`INSERT INTO agents VALUES (${A},'Uno'),(${B},'Dos')`;
  await tx`INSERT INTO crm_leads VALUES (${L},'Cliente','Propio','one@example.test','Nuevo','caliente',${A},'Belgrano',NULL,'2026-10-01'),(${M},'Cliente','Ajeno','two@example.test','Vendido','frio',${B},'',NULL,'2026-10-01')`;
  const add=async(lead,author,type,at,title='Seguimiento',external=null)=>{const id=uuid();await tx`INSERT INTO crm_activities VALUES (${id},${lead},${author},${type},${title},${at},'2026-10-01',${external})`;return id;};
  await add(L,A,'tarea','2026-10-22T02:59:00Z'); // Yesterday in Argentina.
  await add(L,A,'tarea','2026-10-22T03:00:00Z'); // Start of today.
  await add(M,B,'tarea','2026-10-22T13:00:00Z','No filtrar al agente A');
  await add(L,A,'reunion','2026-10-22T14:00:00Z','Reunión válida','google-1');
  const cancelled=await add(L,A,'reunion','2026-10-22T15:00:00Z');
  await tx`INSERT INTO crm_meeting_schedules VALUES (${cancelled},${A},'2026-10-21')`;
  await add(M,A,'reunion','2026-10-22T16:00:00Z','Título privado de otro contacto');
  await tx`INSERT INTO crm_meeting_bookings VALUES (${uuid()},${A},'Cliente Propio','one@example.test','2026-10-22T14:00:00Z','google-1')`;
  const params=[A,'2026-10-22T00:00:00-03:00','2026-10-23T00:00:00-03:00','2026-10-01T00:00:00-03:00',false,'2026-11-01T00:00:00-03:00','all','2026-10-22T12:00:00Z'];
  const [own]=await tx.unsafe(query,params);
  assert.equal(own.counts.total,1);assert.equal(own.counts.tasksToday,1);assert.equal(own.counts.overdue,1);assert.equal(own.tasks.length,2);assert.equal(own.meetings.length,2);assert.equal(own.counts.meetingsToday,2);
  const hidden=own.meetings.find(m=>m.leadId===null);assert.equal(hidden.name,'Reunión agendada');assert.equal(hidden.title,'Reunión agendada');
  assert.equal(own.contacts[0].id,L);assert.equal(own.contacts[0].nextTask,'2026-10-22T03:00:00+00:00');
  const [all]=await tx.unsafe(query,[null,...params.slice(1,4),true,...params.slice(5)]);
  assert.equal(all.counts.total,2);assert.equal(all.counts.sold,1);assert.equal(all.contacts.length,1);
  const soldParams=[...params];soldParams[0]=B;soldParams[6]='Vendido';const [sold]=await tx.unsafe(query,soldParams);assert.equal(sold.contacts[0].id,M);
 });}finally{await sql.end();}
});
