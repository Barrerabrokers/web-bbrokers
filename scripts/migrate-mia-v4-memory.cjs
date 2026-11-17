const postgres = require('postgres');
const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const sql = postgres(url, {ssl:'require', max:1, connect_timeout:8, onnotice:()=>{}});
(async () => {
  try {
    await sql.begin(async tx => {
      const [column] = await tx`select 1 from information_schema.columns
        where table_schema='public' and table_name='mia_clients' and column_name='memoria_v4'`;
      if (column) return;
      await tx`set local lock_timeout = '5s'`;
      await tx`alter table public.mia_clients add column if not exists memoria_v4 jsonb not null default '{}'::jsonb`;
    });
    console.log('MIA V4 memory ready.');
  } finally { await sql.end({timeout:5}); }
})().catch(error => {
  console.error('MIA V4 memory migration failed:', error.code ?? 'configuration');
  process.exitCode = 1;
});
