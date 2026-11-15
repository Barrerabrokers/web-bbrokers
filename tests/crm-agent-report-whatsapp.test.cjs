const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const postgres=require('postgres');
const query=fs.readFileSync('lib/crm-agent-report-db.ts','utf8').match(/AGENT_REPORT_SQL = `([\s\S]*?)`;/)[1];
const enabled=process.env.RUN_DB_TESTS==='1';
if(enabled)require('@next/env').loadEnvConfig(process.cwd());
const A='00000000-0000-0000-0000-000000000001',B='00000000-0000-0000-0000-000000000002';
const L='00000000-0000-0000-0000-000000000011',M='00000000-0000-0000-0000-000000000012';

test('WhatsApp report counts conversations consistently across agents, clients, days and sources',{skip:!enabled},async()=>{
 const sql=postgres(process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.DATABASE_URL,{ssl:'require',max:1,prepare:false,connect_timeout:15});
 try{await sql.begin(async tx=>{
  // Temporary tables shadow the real tables only on this connection. No CRM
  // records are modified, and all fixtures disappear when the connection closes.
  await tx.unsafe(`
   CREATE TEMP TABLE agents(id uuid,name text) ON COMMIT DROP;
   CREATE TEMP TABLE crm_leads(id uuid,first_name text,last_name text,email text,assigned_agent_id uuid) ON COMMIT DROP;
   CREATE TEMP TABLE crm_activities(id uuid,lead_id uuid,created_by uuid,type text,scheduled_at timestamptz,created_at timestamptz,title text,body text,external_source text,external_id text) ON COMMIT DROP;
   CREATE TEMP TABLE crm_meeting_bookings(id uuid,agent_id uuid,starts_at timestamptz,guest_name text,notes text,google_event_id text,guest_email text) ON COMMIT DROP;
   CREATE TEMP TABLE crm_whatsapp_conversations(id uuid,lead_id uuid,channel text) ON COMMIT DROP;
   CREATE TEMP TABLE crm_whatsapp_messages(id uuid,conversation_id uuid,sender_agent_id uuid,created_at timestamptz,content text,direction text,sender_type text,status text,whatsapp_message_id text) ON COMMIT DROP;
  `);
  await tx`INSERT INTO agents VALUES (${A},'Pablo'),(${B},'Martina')`;
  await tx`INSERT INTO crm_leads VALUES (${L},'Cliente','Uno','one@example.test',${A}),(${M},'Cliente','Dos','two@example.test',${A})`;
  let n=100;
  const activity=async(agent,lead,at,type='whatsapp',source=null,title='WhatsApp enviado',external=null)=>{
   const id=`00000000-0000-0000-0000-${String(n++).padStart(12,'0')}`;
   await tx`INSERT INTO crm_activities VALUES (${id},${lead},${agent},${type},${at},${at},${title},'Contenido',${source},${external})`;
  };
  await activity(A,L,'2026-10-01T12:00:00Z','whatsapp',null,'WhatsApp enviado','linked-message');
  await activity(A,L,'2026-10-01T13:00:00Z');
  await activity(A,L,'2026-10-02T02:59:00Z'); // Still Oct 1 in Argentina.
  await activity(A,L,'2026-10-02T03:01:00Z'); // Oct 2 in Argentina.
  await activity(A,M,'2026-10-01T14:00:00Z');
  await activity(B,L,'2026-10-01T15:00:00Z');
  await activity(A,L,'2026-10-01T16:00:00Z','whatsapp','whatsapp_inbound','WhatsApp recibido');
  await activity(A,L,'2026-10-01T12:00:00Z','llamada');
  await activity(A,L,'2026-10-01T13:00:00Z','llamada');
  await activity(A,L,'2026-10-01T17:00:00Z','correo',null,'Correo enviado: Información');
  await activity(A,L,'2026-10-01T18:00:00Z','correo','gmail_inbound','Respuesta');
  await activity(A,L,'2026-10-01T19:00:00Z','reunion');
  const C='00000000-0000-0000-0000-000000000021',D='00000000-0000-0000-0000-000000000022';
  await tx`INSERT INTO crm_whatsapp_conversations VALUES (${C},${L},'whatsapp'),(${D},NULL,'whatsapp')`;
  const message=async(conversation,external,direction='outbound')=>{
   const id=`00000000-0000-0000-0000-${String(n++).padStart(12,'0')}`;
   await tx`INSERT INTO crm_whatsapp_messages VALUES (${id},${conversation},${A},'2026-10-01T20:00:00Z','Mensaje',${direction},'agent','sent',${external})`;
  };
  await message(C,'linked-message'); // Already represented by an activity.
  await message(C,'another-message'); // Same customer/day, different source.
  await message(D,'unlinked-1');
  await message(D,'unlinked-2'); // Same conversation without a linked lead.
  await message(C,'incoming','inbound');
  const [all]=await tx.unsafe(query,[null,'2026-10-01T00:00:00-03:00','2026-10-03T00:00:00-03:00','all',0,true]);
  assert.equal(all.totals.whatsapp,5);
  assert.equal(all.totals.llamada,2);
  assert.equal(all.totals.correo,1);
  assert.equal(all.totals.respuesta,1);
  assert.equal(all.totals.reunion,1);
  assert.deepEqual(all.days.map(d=>[d.day,d.whatsapp]),[['2026-10-01',4],['2026-10-02',1]]);
  assert.equal(all.team.find(a=>a.id===A).whatsapp,4);
  assert.equal(all.team.find(a=>a.id===B).whatsapp,1);
  assert.equal(all.activities.filter(a=>a.channel==='whatsapp').length,5);
  assert.equal(all.totalActivities,10);
  assert.equal(all.contacted,1);assert.equal(all.replied,1);
  const [agent]=await tx.unsafe(query,[A,'2026-10-01T00:00:00-03:00','2026-10-02T00:00:00-03:00','whatsapp',0,false]);
  assert.equal(agent.totals.whatsapp,3);
  assert.equal(agent.totalActivities,3);
  assert.equal(agent.activities.length,3);
  assert.equal(new Date(agent.activities.find(a=>a.leadId===L).at).toISOString(),'2026-10-01T12:00:00.000Z');
  assert.equal(agent.activities.find(a=>a.leadId===null).canOpen,false);
 });}finally{await sql.end()}
});
