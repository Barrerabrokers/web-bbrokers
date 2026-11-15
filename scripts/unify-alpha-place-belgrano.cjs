const fs=require('node:fs'),assert=require('node:assert/strict'),postgres=require('postgres');
require('@next/env').loadEnvConfig(process.cwd());
const sql=postgres(process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.POSTGRES_URL_NON_POOLING||process.env.DATABASE_URL||process.env.SUPABASE_DB_URL,{ssl:'require',max:1,prepare:false,onnotice:()=>{}});
(async()=>{try{await sql.begin(async tx=>{
 await tx`SET LOCAL lock_timeout='5s'`;
 await tx`LOCK TABLE crm_leads IN SHARE ROW EXCLUSIVE MODE`;
 await tx`CREATE TEMP TABLE belgrano_before ON COMMIT DROP AS SELECT * FROM crm_leads`;
 const [before]=await tx`SELECT count(*)::int count FROM crm_leads WHERE development_id='588929b7-ee8d-42cc-a7de-3bb22fd1ab4d' OR lower(btrim(development_name_text)) IN ('alpha place belgrano','alpha place belgrano german')`;
 const [auditBefore]=await tx`SELECT count(*)::int count FROM crm_owner_history`;
 await tx.unsafe(fs.readFileSync('migrations/20261014_unify_alpha_place_belgrano.sql','utf8'));
 const [after]=await tx`SELECT count(*)::int count FROM crm_leads WHERE development_id='588929b7-ee8d-42cc-a7de-3bb22fd1ab4d' AND development_name_text='Alpha Place Belgrano'`;
 assert.equal(after.count,before.count);
 const [preserved]=await tx`SELECT count(*)::int count FROM crm_leads l FULL JOIN belgrano_before b USING(id) WHERE l.id IS NULL OR b.id IS NULL OR (to_jsonb(l)-'development_id'-'development_name_text'-'updated_at') IS DISTINCT FROM (to_jsonb(b)-'development_id'-'development_name_text'-'updated_at')`;
 assert.equal(preserved.count,0,'Cambió información ajena al desarrollo');
 const [other]=await tx`SELECT count(*)::int count FROM crm_leads l JOIN belgrano_before b USING(id) WHERE NOT (b.development_id IS NOT DISTINCT FROM '588929b7-ee8d-42cc-a7de-3bb22fd1ab4d'::uuid OR COALESCE(lower(btrim(b.development_name_text)) IN ('alpha place belgrano','alpha place belgrano german'),false)) AND to_jsonb(l) IS DISTINCT FROM to_jsonb(b)`;
 assert.equal(other.count,0,'Cambió otro desarrollo');
 assert.equal((await tx`SELECT count(*)::int count FROM crm_owner_history`)[0].count,auditBefore.count);
 for(const alias of ['ALpha Place Belgrano','Alpha Place Belgrano German'])await tx.savepoint(async sp=>{
  const [test]=await sp`INSERT INTO crm_leads(id,first_name,last_name,development_name_text) VALUES(gen_random_uuid(),'Verificación','Temporal',${alias}) RETURNING development_id,development_name_text`;
  assert.equal(test.development_id,'588929b7-ee8d-42cc-a7de-3bb22fd1ab4d');assert.equal(test.development_name_text,'Alpha Place Belgrano');
  throw new Error('TEST_ROLLBACK');
 }).catch(e=>{if(e.message!=='TEST_ROLLBACK')throw e});
 await tx.savepoint(async sp=>{
  const [otherDevelopment]=await sp`SELECT id FROM developments WHERE id<>'588929b7-ee8d-42cc-a7de-3bb22fd1ab4d' LIMIT 1`;
  const [test]=await sp`INSERT INTO crm_leads(id,first_name,last_name,development_id,development_name_text) VALUES(gen_random_uuid(),'Verificación','Temporal',${otherDevelopment.id},'Alpha Place Belgrano') RETURNING development_id`;
  assert.equal(test.development_id,otherDevelopment.id,'La regla no debe reemplazar una selección explícita de otro desarrollo');
  throw new Error('TEST_ROLLBACK');
 }).catch(e=>{if(e.message!=='TEST_ROLLBACK')throw e});
 console.log(JSON.stringify({leadsUnificados:after.count,datosDeContactosConservados:true,otrosDesarrollosSinCambios:true,historialPropietariosSinCambios:true,futurosAliasVerificados:true}));
 if(!process.argv.includes('--apply'))throw new Error('CHECK_ROLLBACK');
 });console.log('Unificación aplicada.');}catch(e){if(e.message==='CHECK_ROLLBACK')console.log('Validación correcta; transacción revertida.');else{console.error(e.message);process.exitCode=1}}finally{await sql.end()}})();
