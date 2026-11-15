const fs=require('node:fs'),assert=require('node:assert/strict'),postgres=require('postgres');require('@next/env').loadEnvConfig(process.cwd());
const sql=postgres(process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.POSTGRES_URL_NON_POOLING||process.env.DATABASE_URL||process.env.SUPABASE_DB_URL,{ssl:'require',max:1,prepare:false,onnotice:()=>{}});
(async()=>{try{await sql.begin(async tx=>{
 await tx`SET LOCAL lock_timeout='5s'`;
 await tx.unsafe(fs.readFileSync('migrations/20261014_agenda_hours.sql','utf8'));
 const [bad]=await tx`SELECT count(*)::int n FROM crm_meeting_links WHERE weekdays IS DISTINCT FROM ARRAY[0,1,2,3,4,5,6] OR start_time<>'08:00' OR end_time<>'21:00' OR slot_interval<>30 OR durations IS DISTINCT FROM ARRAY[30,60]`;assert.equal(bad.n,0);
 const [column]=await tx`SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='crm_task_schedules' AND column_name='duration_minutes'`;assert.ok(column);
 const [total]=await tx`SELECT count(*)::int n FROM crm_meeting_links`;
 console.log(JSON.stringify({agendasActualizadas:total.n,dias:'lunes a domingo',horario:'08:00–21:00',intervalo:30,duraciones:[30,60]}));
 if(!process.argv.includes('--apply'))throw new Error('CHECK_ROLLBACK');
 });console.log('Disponibilidad aplicada.');}catch(e){if(e.message==='CHECK_ROLLBACK')console.log('Validación revertida.');else{console.error(e.code||e.message);process.exitCode=1}}finally{await sql.end()}})();
