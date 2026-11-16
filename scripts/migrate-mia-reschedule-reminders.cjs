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
    const schema = await sql`
      select c.relname as relation, a.attname as column, format_type(a.atttypid, a.atttypmod) as type
      from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in ('mia_meetings','mia_reminders','crm_meeting_schedules')
        and a.attnum > 0 and not a.attisdropped`;
    const constraints = await sql`
      select c.relname as relation, p.conname as name, pg_get_constraintdef(p.oid) as definition
      from pg_constraint p join pg_class c on c.oid=p.conrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in ('mia_meetings','mia_reminders','crm_meeting_schedules') and p.contype='c'`;
    console.log('MIA reschedule schema diagnostics:', JSON.stringify({schema,constraints}));
  } finally {
    await sql.end({timeout:5});
  }
}

migrate().catch(error => {
  const code = typeof error.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'configuration';
  console.error('MIA reminder migration failed:', code);
  process.exitCode = 1;
});
