// Explicit, repeatable permission-only containment. No customer-row writes.
const fs = require('node:fs');
require('@next/env').loadEnvConfig(process.cwd());
const postgres = require('postgres');
const databaseUrl = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const sql = postgres(databaseUrl, { ssl: 'require', max: 1, prepare: false, onnotice: () => {} });
const phase = process.argv[2];
const snapshotPath = process.argv[3];
if (!['database','storage'].includes(phase) || !snapshotPath) throw new Error('Usage: node scripts/security-lockdown.cjs database|storage /absolute/snapshot.json');

(async () => {
  const snapshot = {
    phase, at: new Date().toISOString(),
    relations: await sql`SELECT c.relname,c.relkind,c.relrowsecurity,c.relacl::text,pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p','v','S')`,
    policies: await sql`SELECT * FROM pg_policies WHERE schemaname IN('public','storage')`,
    defaults: await sql`SELECT pg_get_userbyid(defaclrole) AS owner,defaclnamespace::regnamespace::text AS schema,defaclobjtype,defaclacl::text FROM pg_default_acl`,
    functions: await sql`SELECT p.oid::regprocedure::text AS signature,p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'`,
  };
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot,null,2), {mode:0o600,flag:'wx'});
  const result = await sql.begin(async tx => {
    await tx`SET LOCAL lock_timeout='5s'`;
    await tx`SET LOCAL statement_timeout='45s'`;
    // Prevent concurrent edits while proving every customer field is unchanged.
    await tx`LOCK TABLE crm_leads IN SHARE MODE`;
    const fingerprint = async () => (await tx`SELECT COUNT(*)::int AS contacts, md5(string_agg(md5(row_to_json(l)::text),'' ORDER BY l.id)) AS fingerprint FROM crm_leads l`)[0];
    const before = await fingerprint();
    if (phase === 'database') {
      for (const table of snapshot.relations.filter(t => ['r','p'].includes(t.relkind))) {
        await tx.unsafe(`ALTER TABLE public."${table.relname.replaceAll('"','""')}" ENABLE ROW LEVEL SECURITY`);
      }
      await tx.unsafe(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
        REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
        REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
        REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;`);
      const exposed = await tx`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind IN('r','p','v') AND
        (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'))`;
      if (exposed.length) throw new Error('Permissions verification failed');
    } else {
      // Keep public delivery of marketing images; remove public listing and writes.
      const policies=snapshot.policies.filter(p=>p.schemaname==='storage'&&p.tablename==='objects'&&p.roles.some(r=>['public','anon','authenticated'].includes(r)));
      for(const policy of policies){
        if(![policy.qual,policy.with_check].some(v=>v&&v.includes("'properties'"))) throw new Error('Unexpected policy; manual review required');
        await tx.unsafe(`DROP POLICY "${policy.policyname.replaceAll('"','""')}" ON storage.objects`);
      }
      const remaining=await tx`SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND roles && ARRAY['public','anon','authenticated']::name[]`;
      if(remaining.length)throw new Error('Unexpected remaining storage policy');
    }
    const after = await fingerprint();
    if (before.contacts !== after.contacts || before.fingerprint !== after.fingerprint) throw new Error('Customer verification failed; rolling back');
    return {phase,contacts:after.contacts,allCustomerFieldsUnchanged:true};
  });
  console.log(JSON.stringify(result));
})().catch(error => {console.error(error.message);process.exitCode=1;}).finally(()=>sql.end());
