require('@next/env').loadEnvConfig(process.cwd());
const sql=require('postgres')(process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.POSTGRES_URL_NON_POOLING||process.env.DATABASE_URL||process.env.SUPABASE_DB_URL,{ssl:'require',max:1,prepare:false,onnotice:()=>{}});
(async()=>{
 await sql.begin(async tx=>{
  await tx`SET LOCAL lock_timeout='5s'`;
  await tx.unsafe(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;
   CREATE OR REPLACE FUNCTION public.advance_agent_session_version() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
   BEGIN
    IF (NEW.password,NEW.role,NEW.active,NEW.email) IS DISTINCT FROM (OLD.password,OLD.role,OLD.active,OLD.email) THEN
      NEW.session_version=OLD.session_version+1;
    ELSE NEW.session_version=OLD.session_version;
    END IF;
    RETURN NEW;
   END $$;
   REVOKE ALL ON FUNCTION public.advance_agent_session_version() FROM PUBLIC,anon,authenticated;
   CREATE OR REPLACE TRIGGER agent_session_security BEFORE UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.advance_agent_session_version();
   CREATE TABLE IF NOT EXISTS auth_login_limits(key TEXT PRIMARY KEY,window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),attempts INTEGER NOT NULL DEFAULT 1);
   ALTER TABLE auth_login_limits ENABLE ROW LEVEL SECURITY;
   REVOKE ALL ON auth_login_limits FROM PUBLIC,anon,authenticated;`);
 });
 console.log('Session versioning and private login limits ready. No customer rows changed.');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>sql.end());
