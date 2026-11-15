const fs=require('node:fs'),assert=require('node:assert/strict'),postgres=require('postgres');
require('@next/env').loadEnvConfig(process.cwd());
const sql=postgres(process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.POSTGRES_URL_NON_POOLING||process.env.DATABASE_URL||process.env.SUPABASE_DB_URL,{ssl:'require',max:1,prepare:false,onnotice:()=>{}});
(async()=>{try{await sql.begin(async tx=>{
 await tx.unsafe(fs.readFileSync('migrations/20261014_owner_history.sql','utf8'));
 const [agent]=await tx`SELECT id,name,email FROM agents WHERE role='admin' LIMIT 1`;
 assert.ok(agent);
 const [lead]=await tx`INSERT INTO crm_leads(id,first_name,last_name,assigned_agent_id) VALUES(gen_random_uuid(),'Verificación temporal de auditoría','Prueba',${agent.id}) RETURNING id`;
 let rows=await tx`SELECT * FROM crm_owner_history WHERE lead_id=${lead.id}`;assert.equal(rows.length,1);assert.equal(rows[0].kind,'initial');
 await tx`SELECT set_config('crm.owner_actor_id',${agent.id},true)`;
 await tx`UPDATE crm_leads SET assigned_agent_id=NULL WHERE id=${lead.id}`;
 rows=await tx`SELECT * FROM crm_owner_history WHERE lead_id=${lead.id} ORDER BY id`;
 assert.equal(rows.length,2);assert.equal(rows[1].actor_id,agent.id);assert.equal(rows[1].previous_owner_id,agent.id);assert.equal(rows[1].owner_id,null);assert.equal(rows[1].actor_name,agent.name||agent.email);
 await tx`UPDATE crm_leads SET assigned_agent_id=NULL WHERE id=${lead.id}`;
 assert.equal((await tx`SELECT * FROM crm_owner_history WHERE lead_id=${lead.id}`).length,2);
 for(const query of ['UPDATE crm_owner_history SET actor_name=actor_name','DELETE FROM crm_owner_history','TRUNCATE crm_owner_history']){
  let blocked=false;try{await tx.savepoint(async sp=>{await sp.unsafe(query)})}catch(error){blocked=error.message.includes('permanente')};assert.ok(blocked,query);
 }
 assert.equal((await tx`SELECT relrowsecurity FROM pg_class WHERE oid='crm_owner_history'::regclass`)[0].relrowsecurity,true);
 throw new Error('VERIFIED_ROLLBACK');
 });}catch(error){if(error.message==='VERIFIED_ROLLBACK')console.log('OK: asignación inicial, autor, desasignación, no-op, RLS y bloqueo UPDATE/DELETE/TRUNCATE. Todo revertido.');else{console.error(error.message);process.exitCode=1}}finally{await sql.end()}})();
