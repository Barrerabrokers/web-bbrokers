const {test}=require('node:test'),assert=require('node:assert/strict');require('../work/mia-web-test/load-ts.cjs');const {reconcileMiaSalesFollowup}=require('../lib/mia-sales-followup.ts');
test('Sunday 20 Argentina is fixed across UTC dates, weekends and callbacks',()=>{
 const {miaSundayFollowupDue:due,miaSundayDispatchOpen:open}=require('../lib/mia-sales-followup.ts');
 assert.equal(due(new Date('2026-10-23T16:00:00Z')),'2026-10-25T23:00:00.000Z');
 assert.equal(due(new Date('2026-10-25T23:00:00Z')),'2026-10-25T23:00:00.000Z');
 assert.equal(due(new Date('2026-10-26T02:59:00Z')),'2026-10-25T23:00:00.000Z');
 assert.equal(due(new Date('2026-10-26T03:00:00Z')),'2026-11-01T23:00:00.000Z');
 assert.equal(due(new Date('2026-10-23T16:00:00Z'),'2026-10-26T15:00:00Z'),'2026-11-01T23:00:00.000Z');
 assert.equal(open(new Date('2026-10-25T22:59:00Z')),false);assert.equal(open(new Date('2026-10-25T23:00:00Z')),true);assert.equal(open(new Date('2026-10-26T02:59:00Z')),true);assert.equal(open(new Date('2026-10-26T03:00:00Z')),false);
});
test('SQL weekly pairs stay fixed despite replies, replace five-day jobs, deduplicate and honor pause/assignment',{skip:process.env.RUN_DB_TESTS!=='1'},async()=>{
 require('@next/env').loadEnvConfig(process.cwd());const sql=require('postgres')(process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.DATABASE_URL,{ssl:'require',max:1,prepare:false,connect_timeout:8});
 const A='00000000-0000-0000-0000-000000000001',L='00000000-0000-0000-0000-000000000002',R='00000000-0000-0000-0000-000000000003';
 try{await sql.begin(async root=>{
 const db=new Proxy(root,{get:(t,k)=>k==='begin'?fn=>t.savepoint(tx=>fn(tx)):t[k]});
 await root.unsafe(`CREATE TEMP TABLE agents(id uuid,active boolean);CREATE TEMP TABLE crm_leads(id uuid,assigned_agent_id uuid);CREATE TEMP TABLE crm_mia_sales_control(run_id uuid,agent_id uuid,enabled boolean,automatic_assignments boolean);CREATE TEMP TABLE crm_mia_sales_enrollments(lead_id uuid,run_id uuid,state text,analysis jsonb);CREATE TEMP TABLE crm_mia_sales_jobs(id uuid,run_id uuid,lead_id uuid,channel text,kind text,source_key text UNIQUE,subject text,content text,due_at timestamptz,followup_anchor_at timestamptz,state text DEFAULT 'pending',error text DEFAULT '');CREATE TEMP TABLE crm_whatsapp_conversations(id uuid,lead_id uuid,assigned_agent_id uuid);CREATE TEMP TABLE crm_whatsapp_messages(conversation_id uuid,created_at timestamptz,direction text,status text,sender_type text);CREATE TEMP TABLE crm_activities(lead_id uuid,type text,title text,created_by uuid,external_source text,created_at timestamptz,scheduled_at timestamptz);`);
 await root`INSERT INTO agents VALUES(${A},TRUE)`;await root`INSERT INTO crm_leads VALUES(${L},${A})`;await root`INSERT INTO crm_mia_sales_control VALUES(${R},${A},TRUE,TRUE)`;await root`INSERT INTO crm_mia_sales_enrollments VALUES(${L},${R},'working','{"action":"contact"}')`;await root`INSERT INTO crm_whatsapp_conversations VALUES(${R},${L},${A})`;await root`INSERT INTO crm_whatsapp_messages VALUES(${R},NOW()-INTERVAL '1 hour','outbound','delivered','ai')`;
 const e={lead_id:L,started_at:'2026-01-01T00:00:00Z'},c={agent_id:A,run_id:R};
 const now=new Date('2026-10-23T16:00:00Z');
 await root`INSERT INTO crm_mia_sales_jobs(id,run_id,lead_id,channel,kind,source_key,due_at,state) VALUES(${R},${R},${L},'email','followup','followup:legacy-five-day','2026-10-28T16:00:00Z','pending')`;
 const first=await reconcileMiaSalesFollowup(db,e,c,now);assert.equal(first.scheduled,2);assert.equal(first.dueAt,'2026-10-25T23:00:00.000Z');assert.equal((await root`SELECT state FROM crm_mia_sales_jobs WHERE source_key='followup:legacy-five-day'`)[0].state,'stopped');
 assert.equal((await reconcileMiaSalesFollowup(db,e,c,now)).scheduled,0);
 await root`INSERT INTO crm_whatsapp_messages VALUES(${R},NOW()-INTERVAL '20 minutes','inbound','sent','contact')`;
 assert.equal((await reconcileMiaSalesFollowup(db,e,c,now)).scheduled,0);assert.equal((await root`SELECT count(*)::int n FROM crm_mia_sales_jobs WHERE state='pending'`)[0].n,2,'A reply during the week does not cancel the fixed Sunday round');
 await root`UPDATE crm_mia_sales_jobs SET state='sent' WHERE channel='email' AND source_key LIKE 'weekly-sunday:%'`;assert.equal((await reconcileMiaSalesFollowup(db,e,c,now)).scheduled,0,'Sending one channel never duplicates either');
 await root`UPDATE crm_mia_sales_jobs SET state='sent' WHERE source_key LIKE 'weekly-sunday:%'`;assert.equal((await reconcileMiaSalesFollowup(db,e,c,now)).scheduled,0,'The same week cannot be sent twice');
 const next=await reconcileMiaSalesFollowup(db,e,c,new Date('2026-10-30T16:00:00Z'));assert.equal(next.scheduled,2);assert.equal(next.dueAt,'2026-11-01T23:00:00.000Z');
 await root`UPDATE crm_mia_sales_control SET enabled=FALSE`;assert.equal((await reconcileMiaSalesFollowup(db,e,c,new Date('2026-11-06T16:00:00Z'))).scheduled,0);
 await root`UPDATE crm_mia_sales_control SET enabled=TRUE`;await root`UPDATE crm_leads SET assigned_agent_id=${R}`;assert.equal((await reconcileMiaSalesFollowup(db,e,c,now)).scheduled,0);await root`UPDATE crm_leads SET assigned_agent_id=${A}`;await root`UPDATE crm_mia_sales_enrollments SET state='stopped'`;assert.equal((await reconcileMiaSalesFollowup(db,e,c,now)).scheduled,0);
 // Drop explicitly inside the test transaction: no persistent or customer tables are modified.
 await root.unsafe('DROP TABLE crm_activities,crm_whatsapp_messages,crm_whatsapp_conversations,crm_mia_sales_jobs,crm_mia_sales_enrollments,crm_mia_sales_control,crm_leads,agents');
 });}finally{await sql.end()}
});
