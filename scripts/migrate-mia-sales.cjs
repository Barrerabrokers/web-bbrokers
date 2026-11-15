require('@next/env').loadEnvConfig(process.cwd());const postgres=require('postgres');
const agentId=process.argv[2], approvedIds=process.argv.slice(3);
if(approvedIds.length!==5||new Set(approvedIds).size!==5)throw Error("Provide exactly the five approved lead IDs.");if(!/^[0-9a-f-]{36}$/i.test(agentId||''))throw Error('Provide the approved MIA agent UUID.');
const sql=postgres(process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.DATABASE_URL,{ssl:'require',max:1,prepare:false});
(async()=>{try{await sql.begin(async tx=>{
 const [agent]=await tx`SELECT id FROM agents WHERE id=${agentId} AND active AND lower(email)='info@barrerabrokers.com'`;if(!agent)throw Error('The approved MIA profile is not available.');
 await tx.unsafe(`CREATE TABLE IF NOT EXISTS crm_mia_sales_control(id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(id),agent_id UUID NOT NULL REFERENCES agents(id),enabled BOOLEAN NOT NULL DEFAULT FALSE,run_id UUID,started_at TIMESTAMPTZ,updated_by UUID REFERENCES agents(id),approved_lead_ids UUID[] NOT NULL DEFAULT '{}',paused_at TIMESTAMPTZ,paused_ai_ids UUID[] NOT NULL DEFAULT '{}');
 CREATE TABLE IF NOT EXISTS crm_mia_sales_enrollments(lead_id UUID PRIMARY KEY REFERENCES crm_leads(id),run_id UUID NOT NULL,original_status TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'working',reason TEXT NOT NULL DEFAULT '',memory JSONB,started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),stopped_at TIMESTAMPTZ);
 CREATE TABLE IF NOT EXISTS crm_mia_sales_jobs(id UUID PRIMARY KEY,run_id UUID NOT NULL,lead_id UUID NOT NULL REFERENCES crm_leads(id),channel TEXT NOT NULL CHECK(channel IN ('email','whatsapp')),kind TEXT NOT NULL CHECK(kind IN ('opening','reply','followup')),source_key TEXT UNIQUE NOT NULL,subject TEXT NOT NULL DEFAULT '',content TEXT NOT NULL DEFAULT '',state TEXT NOT NULL DEFAULT 'pending',error TEXT NOT NULL DEFAULT '',due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),sent_at TIMESTAMPTZ,provider_id TEXT,memory JSONB,followup_anchor_at TIMESTAMPTZ);
 CREATE INDEX IF NOT EXISTS idx_mia_sales_jobs_due ON crm_mia_sales_jobs(state,due_at);
 ALTER TABLE crm_mia_sales_control ENABLE ROW LEVEL SECURITY;
 ALTER TABLE crm_mia_sales_enrollments ENABLE ROW LEVEL SECURITY;
 ALTER TABLE crm_mia_sales_jobs ENABLE ROW LEVEL SECURITY;`);
 const selected=await tx`SELECT id FROM crm_leads WHERE id=ANY(${approvedIds}::uuid[]) AND assigned_agent_id=${agentId}`;if(selected.length!==5)throw Error("Approved leads must remain assigned to MIA.");
 await tx`INSERT INTO crm_mia_sales_control(id,agent_id,approved_lead_ids) VALUES(TRUE,${agentId},${approvedIds}::uuid[]) ON CONFLICT(id) DO NOTHING`;
 });console.log('MIA sales pilot schema ready; disabled; no customer messages sent.');}finally{await sql.end();}})().catch(e=>{console.error(e.message);process.exitCode=1});
