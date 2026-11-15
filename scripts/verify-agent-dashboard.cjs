// Read-only integration check. No contacts, tasks, meetings or messages written.
const fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript'),assert=require('node:assert/strict');
const resolve=Module._resolveFilename;Module._resolveFilename=function(id,parent,...rest){return resolve.call(this,id.startsWith('@/')?path.join(process.cwd(),id.slice(2)):id,parent,...rest);};
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {getAgentDashboard}=require('../lib/crm-agent-dashboard-db.ts'),{dashboardScope}=require('../lib/crm-agent-dashboard.ts'),postgres=require('postgres');
(async()=>{const sql=postgres(process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.POSTGRES_URL_NON_POOLING||process.env.DATABASE_URL||process.env.SUPABASE_DB_URL,{ssl:'require',max:1,prepare:false});try{
 const users=await sql`SELECT DISTINCT ON(role) id,role FROM agents WHERE role IN ('admin','agent') AND active ORDER BY role,id`;
 assert(users.length,'No users to verify');
 for(const user of users){const own=dashboardScope(user),data=await getAgentDashboard(own,user.role==='admin');const [expected]=await sql`SELECT count(*)::int n FROM crm_leads WHERE assigned_agent_id=${own}`;assert.equal(data.counts.total,expected.n);assert.equal(data.pipeline.reduce((sum,s)=>sum+s.count,0),expected.n);if(user.role!=='admin'){assert(data.agents.every(a=>a.id===user.id));assert.throws(()=>dashboardScope(user,'all'));}console.log('AGENT_DASHBOARD_SMOKE',user.role,'own portfolio and scope verified');}
 const all=await getAgentDashboard(null,true);const [expected]=await sql`SELECT count(*)::int n FROM crm_leads`;assert.equal(all.counts.total,expected.n);console.log('AGENT_DASHBOARD_SMOKE administrator team overview verified; no writes');
 }finally{await sql.end();}})().catch(e=>{console.error('AGENT_DASHBOARD_SMOKE failed:',e.message);process.exitCode=1;});
