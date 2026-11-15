const fs=require('node:fs'),assert=require('node:assert/strict'),postgres=require('postgres');require('@next/env').loadEnvConfig(process.cwd());
const sql=postgres(process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.POSTGRES_URL_NON_POOLING||process.env.DATABASE_URL||process.env.SUPABASE_DB_URL,{ssl:'require',max:1,prepare:false,onnotice:()=>{}});
const aliases=['Campaña: Campaña 1 version 21787782816953 · belgrano/nuñez','Campaña: Campaña 1 version 21787782816953 belgrano/nuñez'];
(async()=>{try{await sql.begin(async tx=>{
 await tx`SET LOCAL lock_timeout='5s'`;await tx`LOCK TABLE crm_leads IN SHARE ROW EXCLUSIVE MODE`;
 await tx`CREATE TEMP TABLE campaign_before ON COMMIT DROP AS SELECT * FROM crm_leads`;
 const before=await tx`SELECT id FROM crm_leads WHERE lower(btrim(development_name_text)) IN ${tx(aliases.map(a=>a.toLowerCase()))}`;
 const [totalBefore]=await tx`SELECT count(*)::int n FROM crm_leads WHERE development_id='588929b7-ee8d-42cc-a7de-3bb22fd1ab4d'`;
 await tx.unsafe(fs.readFileSync('migrations/20261014_unify_belgrano_campaign.sql','utf8'));
 const [unexpected]=await tx`SELECT count(*)::int n FROM crm_leads l FULL JOIN campaign_before b USING(id) WHERE l.id IS NULL OR b.id IS NULL OR CASE WHEN b.id IN ${tx(before.length?before.map(r=>r.id):['00000000-0000-0000-0000-000000000000'])} THEN (to_jsonb(l)-'development_id'-'development_name_text'-'updated_at') IS DISTINCT FROM (to_jsonb(b)-'development_id'-'development_name_text'-'updated_at') ELSE to_jsonb(l) IS DISTINCT FROM to_jsonb(b) END`;
 assert.equal(unexpected.n,0);
 const [after]=await tx`SELECT count(*)::int n FROM crm_leads WHERE development_id='588929b7-ee8d-42cc-a7de-3bb22fd1ab4d' AND development_name_text='Alpha Place Belgrano'`;
 assert.equal(after.n,totalBefore.n+before.length);
 const [remaining]=await tx`SELECT count(*)::int n FROM crm_leads WHERE lower(btrim(development_name_text)) IN ${tx(aliases.map(a=>a.toLowerCase()))}`;assert.equal(remaining.n,0);
 for(const alias of aliases)await tx.savepoint(async sp=>{const [row]=await sp`INSERT INTO crm_leads(id,first_name,last_name,development_name_text) VALUES(gen_random_uuid(),'Verificación','Temporal',${alias}) RETURNING development_id,development_name_text`;assert.equal(row.development_id,'588929b7-ee8d-42cc-a7de-3bb22fd1ab4d');assert.equal(row.development_name_text,'Alpha Place Belgrano');throw new Error('TEST_ROLLBACK')}).catch(e=>{if(e.message!=='TEST_ROLLBACK')throw e});
 console.log(JSON.stringify({leadsMovidos:before.length,totalAlphaPlaceBelgrano:after.n,otrosContactosSinCambios:true,datosYPropietariosConservados:true,futurasCargasVerificadas:true}));
 if(!process.argv.includes('--apply'))throw new Error('CHECK_ROLLBACK');
 });console.log('Unificación aplicada.');}catch(e){if(e.message==='CHECK_ROLLBACK')console.log('Validación revertida.');else{console.error(e.message);process.exitCode=1}}finally{await sql.end()}})();
