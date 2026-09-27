// Read-only operational check. Never prints client details or credentials.
require('@next/env').loadEnvConfig(process.cwd());
const postgres=require('postgres');
const url=process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.DATABASE_URL;
if(!url)throw new Error('Falta conexión PostgreSQL');
const sql=postgres(url,{ssl:'require',max:1,prepare:false,connect_timeout:10});
(async()=>{
 try{
  const [state]=await sql`SELECT COUNT(*)::int AS registered,
    COUNT(*) FILTER(WHERE last_analyzed_at IS NOT NULL)::int AS analyzed,
    COUNT(*) FILTER(WHERE last_error IS NOT NULL)::int AS errors,
    COUNT(*) FILTER(WHERE lease_until>now())::int AS processing,
    MAX(model_version) AS model,MAX(last_analyzed_at) AS latest FROM crm_ai_state`;
  const [queue]=await sql`SELECT COUNT(*)::int AS events,COUNT(DISTINCT lead_id)::int AS leads FROM crm_ai_events WHERE processed_at IS NULL`;
  const [usage]=await sql`SELECT requests FROM crm_ai_usage WHERE day=CURRENT_DATE`;
  const [saved]=await sql`SELECT (SELECT COUNT(*)::int FROM crm_ai_recommendations WHERE status='pending') AS recommendations,
    (SELECT COUNT(*)::int FROM crm_ai_history) AS history`;
  console.log(JSON.stringify({state,queue,requestsToday:usage?.requests||0,saved},null,2));
 }finally{await sql.end();}
})().catch(e=>{console.error('No se pudo consultar el estado:',e.code||e.name);process.exitCode=1;});
