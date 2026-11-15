const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');const postgres=require('postgres');
const moduleCopy={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/crm-reminder-notifications.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:moduleCopy,exports:moduleCopy.exports});
const enabled=process.env.RUN_DB_TESTS==='1';if(enabled)require('@next/env').loadEnvConfig(process.cwd());
const A='00000000-0000-0000-0000-000000000001',B='00000000-0000-0000-0000-000000000002',L='00000000-0000-0000-0000-000000000011';
test('web reminders include tasks and meetings at the right boundary, owners, bookings, cancellations and retries',{skip:!enabled},async()=>{
 const sql=postgres(process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.DATABASE_URL,{ssl:'require',max:1,prepare:false});
 try{await sql.begin(async tx=>{
  await tx.unsafe(`
   CREATE TEMP TABLE crm_leads(id uuid,assigned_agent_id uuid,email text,created_at timestamptz,first_name text,last_name text) ON COMMIT DROP;
   CREATE TEMP TABLE crm_activities(id uuid PRIMARY KEY,lead_id uuid,created_by uuid,type text,scheduled_at timestamptz,title text,external_source text,external_id text) ON COMMIT DROP;
   CREATE TEMP TABLE crm_task_schedules(activity_id uuid,reminder_minutes integer) ON COMMIT DROP;
   CREATE TEMP TABLE crm_meeting_schedules(activity_id uuid,calendar_agent_id uuid,cancelled_at timestamptz) ON COMMIT DROP;
   CREATE TEMP TABLE crm_meeting_bookings(id uuid,agent_id uuid,guest_email text,starts_at timestamptz,google_event_id text) ON COMMIT DROP;
   CREATE TEMP TABLE crm_email_trackings(id uuid,agent_id uuid,lead_id uuid,subject text,first_opened_at timestamptz) ON COMMIT DROP;
   CREATE TEMP TABLE crm_notifications(id uuid,recipient_agent_id uuid,lead_id uuid,event_key text UNIQUE,type text,title text,body text,href text,expires_at timestamptz,source_id uuid,created_at timestamptz DEFAULT NOW()) ON COMMIT DROP;
  `);
  await tx`INSERT INTO crm_leads VALUES(${L},${A},'customer@example.test',NOW(),'Cliente','Prueba')`;
  let n=100;const ids=[];
  async function activity(type,minutes,owner=B){const id=`00000000-0000-0000-0000-${String(n++).padStart(12,'0')}`;ids.push(id);await tx`INSERT INTO crm_activities VALUES(${id},${L},${owner},${type},NOW()+make_interval(mins=>${minutes}),'Llamar o reunir',NULL,NULL)`;return id;}
  const task=await activity('tarea',60);await activity('tarea',61);await activity('tarea',-1);
  const earlyTask=await activity('tarea',600);await tx`INSERT INTO crm_task_schedules VALUES(${earlyTask},720)`;
  const meeting=await activity('reunion',60);await tx`INSERT INTO crm_meeting_schedules VALUES(${meeting},${B},NULL)`;
  const cancelled=await activity('reunion',30);await tx`INSERT INTO crm_meeting_schedules VALUES(${cancelled},${B},NOW())`;
  await activity('reunion',61);
  const booking='00000000-0000-0000-0000-000000000050';
  await tx`INSERT INTO crm_meeting_bookings VALUES(${booking},${B},'outside@example.test',NOW()+INTERVAL '45 minutes','booking-only')`;
  await tx`INSERT INTO crm_email_trackings VALUES('00000000-0000-0000-0000-000000000060',${B},${L},'Subject',NOW()-INTERVAL '1 minute')`;
  await moduleCopy.exports.persistCrmReminderNotifications(tx);
  let rows=await tx`SELECT * FROM crm_notifications ORDER BY type,event_key`;
  assert.equal(rows.length,5);
  assert.equal(rows.filter(r=>r.type==='task_reminder').length,2);
  assert.ok(rows.filter(r=>r.type==='task_reminder').every(r=>r.recipient_agent_id===A));
  assert.ok(rows.filter(r=>r.type==='meeting_reminder').every(r=>r.recipient_agent_id===B));
  assert.equal(rows.find(r=>r.event_key.startsWith('booking:')).lead_id,null);
  assert.equal(rows.find(r=>r.type==='email_open').recipient_agent_id,B);
  assert.equal(rows.find(r=>r.type==='email_open').title,'Cliente Prueba abrió tu correo');
  assert.match(rows.find(r=>r.type==='email_open').href,/email=00000000-0000-0000-0000-000000000060$/);
  await moduleCopy.exports.persistCrmReminderNotifications(tx);
  assert.equal((await tx`SELECT count(*)::int count FROM crm_notifications`)[0].count,5);
  await tx.unsafe(`CREATE TEMP TABLE crm_device_notification_state(id boolean,enabled_at timestamptz) ON COMMIT DROP; INSERT INTO crm_device_notification_state VALUES(TRUE,NOW()-INTERVAL '1 day')`);
  await tx`INSERT INTO crm_notifications(recipient_agent_id,event_key,type,created_at) VALUES(${B},'reply:test','email_reply',NOW())`;
  const pushSql=fs.readFileSync('lib/crm-push.ts','utf8').match(/PUSH_NOTIFICATION_SQL = `([\s\S]*?)`;/)[1];
  const before=new Date(Date.now()-300000);
  const candidates=await tx.unsafe(pushSql,[B,before,true,true,true,true]);
  assert.deepEqual(candidates.map(r=>r.kind).sort(),['meeting','meeting','open','reply']);
  assert.equal((await tx.unsafe(pushSql,[B,before,false,false,false,false])).length,0);
  assert.equal((await tx.unsafe(pushSql,[A,before,true,true,true,true])).length,2);
  assert.equal((await tx.unsafe(pushSql,[B,new Date(Date.now()+60000),true,true,true,true])).length,2);
  await tx`UPDATE crm_leads SET assigned_agent_id=${B} WHERE id=${L}`;
  await moduleCopy.exports.persistCrmReminderNotifications(tx);
  assert.equal((await tx.unsafe(pushSql,[B,before,false,false,true,false])).length,2);
  await tx`UPDATE crm_leads SET assigned_agent_id=${A} WHERE id=${L}`;
  await moduleCopy.exports.persistCrmReminderNotifications(tx);
  await tx`UPDATE crm_activities SET scheduled_at=NOW()+INTERVAL '2 hours' WHERE id=${task}`;
  await tx`UPDATE crm_meeting_schedules SET cancelled_at=NOW() WHERE activity_id=${meeting}`;
  await moduleCopy.exports.persistCrmReminderNotifications(tx);
  assert.equal((await tx`SELECT count(*)::int count FROM crm_notifications WHERE expires_at>NOW()`)[0].count,2);
 });}finally{await sql.end()}
});
