const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
require('../work/mia-web-test/load-ts.cjs');
const policy=require('../lib/mia-sales-policy.ts'),oauth=require('../lib/mia-sales-oauth.ts');
const A='00000000-0000-0000-0000-000000000001',B='00000000-0000-0000-0000-000000000002';
function load(file,mocks){const m=new Module(file);m.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id.startsWith('.')?'../lib/'+id.slice(2)+'.ts':id);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);return m.exports;}
test('reactivation distinguishes old disinterest, a fresh refusal and a real opt-out',()=>{
 assert.equal(policy.miaSalesOptOut('No me interesa'),false);assert.equal(policy.miaSalesDecline('No me interesa, gracias'),true);
 for(const s of ['No me escribas más','Dame de baja','STOP','Baja','No quiero recibir mensajes','Dejá de contactarme'])assert.equal(policy.miaSalesOptOut(s),true,s);
 assert.equal(policy.miaSalesTerminal('No interesado / no califica'),false);assert.equal(policy.miaSalesTerminal('Vendido'),true);
 assert.equal(policy.miaSalesHours(new Date('2026-10-22T13:00:00Z')),true);assert.equal(policy.miaSalesHours(new Date('2026-10-24T13:00:00Z')),false);assert.equal(policy.miaSalesHours(new Date('2026-10-22T21:00:00Z')),false);
 const now=Date.parse('2026-10-22T16:00:00Z');assert.equal(policy.miaSalesTextWindow('2026-10-21T17:00:00Z',now),false);assert.equal(policy.miaSalesTextWindow('2026-10-22T15:00:00Z',now),true);assert.equal(policy.miaSalesTextWindow('2026-10-22T17:00:00Z',now),false);
 assert.match(policy.miaSalesOpening('Lucía','Belgrano'),/asistente virtual/);assert.match(policy.miaSalesOpening('Lucía','Belgrano'),/preferís que no volvamos/);
});
test('MIA mail authorization is bound to administrator, profile, nonce and expiration',()=>{
 const previous=process.env.NEXTAUTH_SECRET;process.env.NEXTAUTH_SECRET='test-only-mia-secret';
 try{const token=oauth.signMiaMailTarget(A,B,'info@example.test','nonce',1000);assert.equal(oauth.readMiaMailTarget(token,{id:A,role:'admin'},'nonce',2000).target,B);
 for(const [actor,state,at] of [[{id:B,role:'admin'},'nonce',2000],[{id:A,role:'agent'},'nonce',2000],[{id:A,role:'admin'},'other',2000],[{id:A,role:'admin'},'nonce',999999]])assert.throws(()=>oauth.readMiaMailTarget(token,actor,state,at));
 assert.throws(()=>oauth.readMiaMailTarget(token.slice(0,-1)+(token.endsWith('a')?'b':'a'),{id:A,role:'admin'},'nonce',2000));
 }finally{if(previous===undefined)delete process.env.NEXTAUTH_SECRET;else process.env.NEXTAUTH_SECRET=previous;}
});
test('Google callback connects only the approved mailbox to MIA and preserves ordinary sign-in',async()=>{
 const previous=process.env.NEXTAUTH_SECRET;process.env.NEXTAUTH_SECRET='callback-test-secret';
 let actor={id:A,role:'admin',name:'Admin'},profileEmail='info@barrerabrokers.com',writes=[],starts=0,firstRun=false;
 const sql=async(strings)=>strings.join('').includes('SELECT a.email')?[{email:'info@barrerabrokers.com'}]:[{run_id:firstRun?null:'existing',approved_lead_ids:[B]}];sql.end=async()=>{};
 try{const api=load('app/api/crm/google/callback/route.ts',{
  'next-auth':{getServerSession:async()=>({user:actor})},'@/lib/auth':{authOptions:{}},'@/lib/mia-sales-oauth':oauth,
  '@/lib/mia-sales-store':{miaSalesDb:()=>sql,startMiaSalesPilot:async()=>{starts++;}},
  '@/lib/google-oauth':{exchangeGoogleCode:async()=>({access_token:'test',refresh_token:'test',scope:'gmail.send gmail.readonly'}),getGoogleUserInfo:async()=>({email:profileEmail,name:'Info'})},
  '@/lib/db':{upsertCrmEmailAccount:async input=>{writes.push(input);return {account:{id:'account'}};}},
  '@/lib/roles':require('../lib/roles.ts')
 });
 const {NextRequest}=require('next/server'),token=oauth.signMiaMailTarget(A,B,profileEmail,'nonce');
 const request=(target=true)=>new NextRequest('https://example.test/api/crm/google/callback?code=test&state=nonce',{headers:{cookie:'bb_google_oauth_state=nonce'+(target?'; bb_google_oauth_mia='+token:'')}});
 let response=await api.GET(request());assert.equal(writes[0].agentId,B);assert.equal(starts,0);assert.match(response.headers.get('location'),/miaPilot=1/);
 writes=[];firstRun=true;await api.GET(request());assert.equal(starts,1);assert.equal(writes.length,1);
 writes=[];profileEmail='other@example.test';response=await api.GET(request());assert.equal(writes.length,0);assert.match(response.headers.get('location'),/google=error/);
 actor={id:A,role:'agent',name:'Agent'};writes=[];response=await api.GET(request());assert.equal(writes.length,0);assert.match(response.headers.get('location'),/invalid_mia_target/);
 writes=[];profileEmail='own@example.test';await api.GET(request(false));assert.equal(writes[0].agentId,A);assert.equal(starts,1);
 }finally{if(previous===undefined)delete process.env.NEXTAUTH_SECRET;else process.env.NEXTAUTH_SECRET=previous;}
});
test('WhatsApp recontact uses only the selected approved body template',async()=>{
 const originalFetch=global.fetch;let status='PENDING',extra=false,seen=[];
 const sql=async()=>[{value:JSON.stringify({name:'mia_test_template'})}];sql.end=async()=>{};
 const worker=load('lib/mia-sales-worker.ts',{'./mia-sales-store':{miaSalesDb:()=>sql},'./whatsapp-credentials':{getWhatsAppChannelCredentials:async()=>({accessToken:'test-only',wabaId:'123'})}});
 global.fetch=async url=>{seen.push(String(url));return {ok:true,json:async()=>({data:[{name:'mia_test_template',status,language:'es_AR',components:[{type:'BODY',text:'Hola {{1}}, soy MIA de Barrera Brokers. Retomo tu consulta sobre {{2}}.'},...(extra?[{type:'BUTTONS'}]:[])]}]})};};
 try{await assert.rejects(()=>worker.approvedMiaSalesTemplate(),/pendiente/);status='APPROVED';const template=await worker.approvedMiaSalesTemplate();assert.equal(template.name,'mia_test_template');assert(seen.every(url=>url.includes('name=mia_test_template')));extra=true;await assert.rejects(()=>worker.approvedMiaSalesTemplate(),/compatible/);}finally{global.fetch=originalFetch;}
});
test('MIA connection returns signed-out users to the pilot and rejects non-admins',async()=>{
 let session=null;
 const api=load('app/api/crm/google/connect/route.ts',{'next-auth':{getServerSession:async()=>session},'@/lib/auth':{authOptions:{}},'@/lib/mia-sales-store':{miaSalesDb:()=>{throw Error('Must not access another profile');}},'@/lib/mia-sales-oauth':oauth,'@/lib/google-oauth':{buildGoogleOAuthUrl:()=>{throw Error('Must not start authorization');}},'@/lib/roles':require('../lib/roles.ts')});
 const {NextRequest}=require('next/server'),request=new NextRequest('https://example.test/api/crm/google/connect?miaSales=1');
 const response=await api.GET(request);assert.equal(new URL(response.headers.get('location')).searchParams.get('from'),'/admin/crm/panel-agentes?miaPilot=1');
 session={user:{id:A,role:'agent'}};assert.equal((await api.GET(request)).status,403);
});
test('pilot enrollment, delivery claims, pause, opt-out and assignment are durable and limited',{skip:process.env.RUN_DB_TESTS!=='1'},async()=>{
 require('@next/env').loadEnvConfig(process.cwd());const postgres=require('postgres'),sql=postgres(process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.DATABASE_URL,{ssl:'require',max:1,prepare:false});
 const ids=Array.from({length:5},(_,i)=>`00000000-0000-0000-0000-${String(i+11).padStart(12,'0')}`),sent=[];let fail=false;
 try{await sql.begin(async root=>{
  function wrap(tx){return new Proxy(tx,{get:(t,k)=>k==='end'?async()=>{}:k==='begin'?(fn)=>t.savepoint(nested=>fn(wrap(nested))):t[k]});}
  const db=wrap(root);
  await root.unsafe(`CREATE TEMP TABLE agents(id uuid,name text,email text,role text,active boolean) ON COMMIT DROP;
   CREATE TEMP TABLE developments(id uuid,name text) ON COMMIT DROP;
   CREATE TEMP TABLE crm_leads(id uuid,first_name text,last_name text,email text,phone text,country_code text,status text,notes text,assigned_agent_id uuid,development_id uuid,development_name_text text,updated_at timestamptz DEFAULT NOW(),created_at timestamptz DEFAULT NOW()) ON COMMIT DROP;
   CREATE TEMP TABLE crm_email_accounts(agent_id uuid,provider text,google_scopes text,email text) ON COMMIT DROP;
   CREATE TEMP TABLE crm_whatsapp_conversations(id uuid PRIMARY KEY,lead_id uuid,assigned_agent_id uuid,channel text,business_phone_number_id text,ai_enabled boolean,ai_assist_assigned boolean,status text,locked_until timestamptz,updated_at timestamptz DEFAULT NOW()) ON COMMIT DROP;
   CREATE TEMP TABLE crm_whatsapp_messages(id uuid,conversation_id uuid,content text,direction text,status text,created_at timestamptz) ON COMMIT DROP;
   CREATE TEMP TABLE crm_activities(id uuid,lead_id uuid,type text,body text,external_source text,scheduled_at timestamptz,created_at timestamptz) ON COMMIT DROP;
   CREATE TEMP TABLE crm_meeting_bookings(id uuid,guest_email text,starts_at timestamptz,created_at timestamptz) ON COMMIT DROP;
   CREATE TEMP TABLE crm_notifications(id uuid,recipient_agent_id uuid,lead_id uuid,event_key text UNIQUE,type text,title text,body text,href text) ON COMMIT DROP;
   CREATE TEMP TABLE database_worker_leases(worker_key text PRIMARY KEY,owner uuid,lease_until timestamptz) ON COMMIT DROP;
   CREATE TEMP TABLE crm_mia_sales_control(id boolean PRIMARY KEY,agent_id uuid,enabled boolean DEFAULT FALSE,run_id uuid,started_at timestamptz,updated_by uuid,approved_lead_ids uuid[],automatic_assignments boolean DEFAULT FALSE,paused_ai_ids uuid[] DEFAULT '{}',paused_at timestamptz) ON COMMIT DROP;
   CREATE TEMP TABLE crm_mia_sales_enrollments(lead_id uuid PRIMARY KEY,run_id uuid,original_status text,state text DEFAULT 'working',reason text DEFAULT '',memory jsonb,analysis jsonb,started_at timestamptz DEFAULT NOW(),stopped_at timestamptz) ON COMMIT DROP;
   CREATE TEMP TABLE crm_mia_sales_jobs(id uuid PRIMARY KEY,run_id uuid,lead_id uuid,channel text,kind text,source_key text UNIQUE,subject text,content text,state text DEFAULT 'pending',error text DEFAULT '',due_at timestamptz DEFAULT NOW(),created_at timestamptz DEFAULT NOW(),sent_at timestamptz,provider_id text,memory jsonb) ON COMMIT DROP;`);
  await root`INSERT INTO agents VALUES(${A},'Mia','info@barrerabrokers.com','agent',TRUE)`;
  await root`INSERT INTO crm_mia_sales_control(id,agent_id,approved_lead_ids) VALUES(TRUE,${A},${ids}::uuid[])`;
  for(const id of ids)await root`INSERT INTO crm_leads(id,first_name,last_name,email,phone,country_code,status,notes,assigned_agent_id,development_name_text) VALUES(${id},'Cliente','Prueba',${id+'@example.test'},'1112345678','+54','No interesado / no califica','Descartado por un agente',${A},'Belgrano')`;
  const store=load('lib/mia-sales-store.ts',{postgres:()=>db});
  await assert.rejects(()=>store.startMiaSalesPilot(B,[B]),/limitado a los cinco/);
  await assert.rejects(()=>store.startMiaSalesPilot(B,ids),/Conectá el correo/);assert.equal((await root`SELECT count(*)::int n FROM crm_mia_sales_jobs`)[0].n,0);
  await root`INSERT INTO crm_email_accounts VALUES(${A},'google-oauth','gmail.readonly gmail.send','info@barrerabrokers.com')`;
  await assert.rejects(()=>store.startMiaSalesPilot(B,[...ids,'00000000-0000-0000-0000-000000000099']),/cinco/);
  await root`UPDATE crm_leads SET assigned_agent_id=${B} WHERE id=${ids[0]}`;await assert.rejects(()=>store.startMiaSalesPilot(B,ids),/asignados/);await root`UPDATE crm_leads SET assigned_agent_id=${A} WHERE id=${ids[0]}`;
  const started=await store.startMiaSalesPilot(B,ids);assert.equal(started.contacts,5);assert.equal((await root`SELECT count(*)::int n FROM crm_mia_sales_jobs`)[0].n,10);assert.equal((await root`SELECT count(*)::int n FROM crm_leads WHERE status='No interesado / no califica'`)[0].n,5);
  await assert.rejects(()=>store.startMiaSalesPilot(B,ids),/ya tiene/);
  const worker=load('lib/mia-sales-worker.ts',{
   './mia-sales-store':{...store,miaSalesDb:()=>db},'./mia-sales-policy':{...policy,miaSalesHours:()=>true},
   './crm-sales-context':{getSalesEvidence:async()=>[{events:[]}]},'./db':{getCrmLeadById:async (id,options)=>{assert.equal(options?.agentId,A);return {id,email:id+'@example.test',firstName:'Cliente',lastName:'Prueba'}}},
   './crm-email-sender':{sendCrmEmail:async input=>{sent.push(input.lead.id);if(fail)throw Error('Provider response lost');return {sent:true,activity:{id:require('crypto').randomUUID()}};}}
  });
  await root`UPDATE crm_mia_sales_jobs SET due_at=NOW() WHERE channel='email'`;
  await worker.processMiaSalesPilot();await worker.processMiaSalesPilot();await worker.processMiaSalesPilot();assert.equal(sent.length,5,JSON.stringify(await root`SELECT state,error FROM crm_mia_sales_jobs WHERE channel='email'`));assert.equal(new Set(sent).size,5);
  assert.equal((await root`SELECT count(*)::int n FROM crm_mia_sales_jobs WHERE state='sent'`)[0].n,5);
  await root`UPDATE crm_mia_sales_jobs SET state='pending',due_at=NOW() WHERE lead_id=${ids[0]} AND channel='email'`;fail=true;await worker.processMiaSalesPilot();assert.equal(sent.length,6);await worker.processMiaSalesPilot();assert.equal(sent.length,6);assert.equal((await root`SELECT state FROM crm_mia_sales_jobs WHERE lead_id=${ids[0]} AND channel='email'`)[0].state,'review');
  await store.pauseMiaSalesPilot(B,false);await worker.processMiaSalesPilot();assert.equal(sent.length,6);await store.pauseMiaSalesPilot(B,true);
  await root`INSERT INTO crm_activities VALUES(${require('crypto').randomUUID()},${ids[1]},'correo','No me contactes más','gmail_inbound',NOW(),NOW())`;await worker.processMiaSalesPilot();assert.equal((await root`SELECT state FROM crm_mia_sales_enrollments WHERE lead_id=${ids[1]}`)[0].state,'stopped');
  await root`UPDATE crm_leads SET assigned_agent_id=${B} WHERE id=${ids[2]}`;await worker.processMiaSalesPilot();assert.equal((await root`SELECT state FROM crm_mia_sales_enrollments WHERE lead_id=${ids[2]}`)[0].state,'stopped');assert.equal(sent.length,6);
  await root.unsafe(`ALTER TABLE crm_notifications ADD COLUMN created_at timestamptz DEFAULT NOW(),ADD COLUMN expires_at timestamptz;
   CREATE TEMP TABLE crm_email_trackings(id uuid,lead_id uuid) ON COMMIT DROP;
   CREATE TEMP TABLE crm_device_notification_state(id boolean,enabled_at timestamptz) ON COMMIT DROP;`);
  await root`INSERT INTO agents VALUES(${B},'Administrador','admin@example.test','admin',TRUE)`;
  const {PUSH_NOTIFICATION_SQL}=require('../lib/crm-push.ts');
  const args=id=>[id,'2026-01-01T00:00:00Z',true,true,true,true];
  assert.equal((await root.unsafe(PUSH_NOTIFICATION_SQL,args(A))).length,0,'MIA/agents cannot read admin supervision alerts');
  assert((await root.unsafe(PUSH_NOTIFICATION_SQL,args(B))).length>0,'Administrators receive pilot supervision alerts');
  await root.unsafe(`ALTER TABLE crm_activities ADD COLUMN title text,ADD COLUMN created_by uuid,ADD COLUMN external_id text;
   CREATE UNIQUE INDEX test_mia_ext ON crm_activities(external_source,external_id) WHERE external_source IS NOT NULL AND external_id IS NOT NULL;`);
  let decision='contact';const newer='00000000-0000-0000-0000-000000000088';
  await root`INSERT INTO crm_leads(id,first_name,status,notes,assigned_agent_id) VALUES(${newer},'Nueva','Nuevo','Pidió dos ambientes',${A})`;
  const assignment=load('lib/mia-sales-assignment.ts',{
   './mia-sales-store':{...store,miaSalesDb:()=>db},
   './crm-sales-context':{getSalesEvidence:async()=>[{total:0,events:[]}]},
   './mia-sales-analysis':{analyzeMiaSalesHistory:async h=>{assert.equal(h.lead.notes,'Pidió dos ambientes');return {action:decision,summary:'Busca dos ambientes',reason:'Continuar según historial',message:'Hola, soy MIA, la asistente virtual de Barrera Brokers. ¿Seguís buscando dos ambientes?',topic:'dos ambientes',nextContactAt:decision==='wait'?'2030-11-01T15:00:00Z':null,evidenceIds:[],analyzedAt:new Date().toISOString(),eventsRead:0,eventsTotal:0}}}
  });
  assert.equal(await assignment.enrollAssignedMiaContacts(db),0,'Automatic assignment remains off by default');
  await root`UPDATE crm_mia_sales_control SET automatic_assignments=TRUE,enabled=FALSE`;assert.equal(await assignment.enrollAssignedMiaContacts(db),0,'Global pause blocks enrollments');
  await root`UPDATE crm_mia_sales_control SET enabled=TRUE`;assert.equal(await assignment.enrollAssignedMiaContacts(db,[]),0,'An empty assignment cannot enroll unrelated contacts');assert.equal(await assignment.enrollAssignedMiaContacts(db,[newer]),1);assert.equal(await assignment.enrollAssignedMiaContacts(db,[newer]),0,'No duplicate openings');assert((await root`SELECT bool_and(due_at<=NOW()) ok FROM crm_mia_sales_jobs WHERE lead_id=${newer}`)[0].ok,'Email and WhatsApp are due immediately, without a 24-hour gap');
  assert.equal((await root`SELECT count(*)::int n FROM crm_mia_sales_jobs WHERE lead_id=${newer}`)[0].n,2);assert.equal((await root`SELECT status FROM crm_leads WHERE id=${newer}`)[0].status,'Nuevo');
  let [enrollment]=await root`SELECT * FROM crm_mia_sales_enrollments WHERE lead_id=${newer}`;const [config]=await root`SELECT * FROM crm_mia_sales_control`;
  await assignment.prepareMiaSalesContact(db,enrollment,config);assert.equal((await root`SELECT analysis->>'action' action FROM crm_mia_sales_enrollments WHERE lead_id=${newer}`)[0].action,'contact');assert.equal((await root`SELECT count(*)::int n FROM crm_activities WHERE lead_id=${newer} AND external_source='mia_sales_analysis'`)[0].n,1);
  const conversation='00000000-0000-0000-0000-000000000089';await root`INSERT INTO crm_whatsapp_conversations(id,lead_id,assigned_agent_id,channel,business_phone_number_id,ai_enabled,ai_assist_assigned,status) VALUES(${conversation},${newer},${A},'whatsapp',${require('../lib/whatsapp-inbox-scope.ts').firstContactWhatsAppPhoneId()},TRUE,TRUE,'open')`;
  decision='wait';await assignment.prepareMiaSalesContact(db,enrollment,config);assert.equal((await root`SELECT ai_enabled FROM crm_whatsapp_conversations WHERE id=${conversation}`)[0].ai_enabled,true,'Waiting for proactive contact must not pause an already active inbound assistant');assert((await root`SELECT bool_and(due_at>='2030-11-01T15:00:00Z') ok FROM crm_mia_sales_jobs WHERE lead_id=${newer}`)[0].ok);
  decision='review';await assignment.prepareMiaSalesContact(db,enrollment,config);assert.equal((await root`SELECT state FROM crm_mia_sales_enrollments WHERE lead_id=${newer}`)[0].state,'stopped');assert.equal(await assignment.enrollAssignedMiaContacts(db),0,'Stopped contacts are never resurrected');assert.equal(sent.length,6,'Analysis and assignment do not send any provider messages');

 });}finally{await sql.end();}
});
