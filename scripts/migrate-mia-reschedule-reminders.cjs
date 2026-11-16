const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const postgres = require('postgres');

async function migrate() {
  const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!url) throw new Error('Missing database configuration');
  const sql = postgres(url, {ssl:'require', prepare:false, max:1, connect_timeout:8, onnotice:()=>{}});
  try {
    await sql.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtext('mia-reschedule-reminders-migration'))`;
      const [schema] = await tx`select to_regclass('public.mia_reminders_meeting_type_active_key') is not null as applied`;
      if (schema.applied) return;
      await tx`set local lock_timeout = '5s'`;
      const migration = readFileSync(join(__dirname,'../migrations/20261116_mia_reschedule_reminders.sql'),'utf8')
        .replace(/^begin;\s*/i,'').replace(/\s*commit;\s*$/i,'');
      await tx.unsafe(migration).simple();
    });
    console.log('MIA reminder rescheduling schema ready.');

  } finally {
    await sql.end({timeout:5});
  }
}

migrate().catch(error => {
  const code = typeof error.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'configuration';
  console.error('MIA reminder migration failed:', code);
  process.exitCode = 1;
});
