const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(file) {
  const module={exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
    {module,exports:module.exports,require:()=>({}),process,console});
  return module.exports;
}
test('meeting status recognizes both CRM spellings',()=>{
  const {isMeetingStatus}=load('lib/crm-statuses.ts');
  for(const value of ['Reunion','Reunión',' REUNIÓN '])assert.equal(isMeetingStatus(value),true);
  for(const value of ['',undefined,'Nuevo'])assert.equal(isMeetingStatus(value),false);
});
test('schema initialization is shared, and failed initialization can retry',async()=>{
  const m=load('lib/crm-meeting-lifecycle.ts');let calls=0;
  const sql={unsafe:async()=>{calls++;if(calls===1)throw Error('unavailable');}};
  await assert.rejects(m.ensureMeetingLifecycle(sql),/unavailable/);
  await Promise.all([m.ensureMeetingLifecycle(sql),m.ensureMeetingLifecycle(sql)]);
  assert.equal(calls,2);
});
test('Postgres enforces booking and outcome rules without modifying customer data',{skip:process.env.MEETING_DB_TEST!=='1'},async()=>{
  require('@next/env').loadEnvConfig(process.cwd());
  const sql=require('postgres')(process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.POSTGRES_URL_NON_POOLING||process.env.DATABASE_URL||process.env.SUPABASE_DB_URL,{ssl:'require',max:1,prepare:false,onnotice:()=>{}});
  let ddl;await load('lib/crm-meeting-lifecycle.ts').ensureMeetingLifecycle({unsafe:async value=>{ddl=value;}});
  try {
    await sql.begin(async tx=>{
      await tx.unsafe(`
        CREATE TEMP TABLE crm_leads(id UUID PRIMARY KEY,status TEXT) ON COMMIT DROP;
        CREATE TEMP TABLE crm_activities(id UUID PRIMARY KEY,lead_id UUID,type TEXT,external_source TEXT,external_id TEXT,scheduled_at TIMESTAMPTZ) ON COMMIT DROP;
        CREATE TEMP TABLE crm_meeting_schedules(activity_id UUID,ends_at TIMESTAMPTZ,cancelled_at TIMESTAMPTZ) ON COMMIT DROP;
        CREATE TEMP TABLE crm_activity_results(activity_id UUID,outcome TEXT,outcome_status TEXT) ON COMMIT DROP;
      `);
      const definition=ddl.slice(ddl.indexOf('CREATE OR REPLACE FUNCTION'));
      await tx.unsafe(definition.replaceAll('crm_require_meeting()', 'pg_temp.crm_require_meeting()'));
      const lead='00000000-0000-4000-8000-000000000001',activity='00000000-0000-4000-8000-000000000002';
      const reject=async query=>assert.rejects(tx.savepoint(query),/agendar|resultado/);
      await reject(t=>t`INSERT INTO crm_leads VALUES(${lead},'Reunión')`);
      await tx`INSERT INTO crm_leads VALUES(${lead},'Nuevo')`;
      await reject(t=>t`UPDATE crm_leads SET status='Reunion' WHERE id=${lead}`);
      await tx`INSERT INTO crm_activities VALUES(${activity},${lead},'reunion','google_calendar','test-event',NOW()+INTERVAL '1 hour')`;
      await tx`INSERT INTO crm_meeting_schedules VALUES(${activity},NOW()+INTERVAL '2 hours',NULL)`;
      await tx`UPDATE crm_leads SET status='Reunion' WHERE id=${lead}`;
      await tx`UPDATE crm_meeting_schedules SET ends_at=NOW()-INTERVAL '1 minute'`;
      // Ordinary edits/upserts must not be blocked when the status is unchanged.
      await tx`INSERT INTO crm_leads VALUES(${lead},'Reunion') ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status`;
      await reject(t=>t`UPDATE crm_leads SET status='Seguimiento' WHERE id=${lead}`);
      await tx`INSERT INTO crm_activity_results VALUES(${activity},'Visitó la propiedad','completed')`;
      await tx`UPDATE crm_leads SET status='Seguimiento' WHERE id=${lead}`;
      await tx`UPDATE crm_meeting_schedules SET ends_at=NOW()+INTERVAL '2 hours',cancelled_at=NOW()`;
      await tx`UPDATE crm_activity_results SET outcome=''`;
      await reject(t=>t`UPDATE crm_leads SET status='Cerrado' WHERE id=${lead}`);
      await tx`UPDATE crm_activity_results SET outcome='El cliente pidió cancelar',outcome_status='cancelled'`;
      await tx`UPDATE crm_leads SET status='Cerrado' WHERE id=${lead}`;
      await reject(t=>t`UPDATE crm_leads SET status='Reunion' WHERE id=${lead}`);
    });
  } finally {await sql.end();}
});
