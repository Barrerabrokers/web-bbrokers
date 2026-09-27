const fs=require('node:fs');
const postgres=require('postgres');
require('@next/env').loadEnvConfig(process.cwd());
const url=process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.DATABASE_URL;
if(!url)throw new Error('Falta la conexión PostgreSQL');
const sql=postgres(url,{ssl:'require',max:1,prepare:false});
const check=process.argv.includes('--check');
(async()=>{try{await sql.begin(async tx=>{await tx`SET LOCAL lock_timeout='5s'`;await tx.unsafe(fs.readFileSync('migrations/202609_ai_sales.sql','utf8'));if(check)throw new Error('CHECK_ROLLBACK');});console.log('AI Sales: migración aplicada.');}catch(e){if(check&&e.message==='CHECK_ROLLBACK')console.log('AI Sales: esquema validado; transacción revertida sin cambios.');else throw e;}finally{await sql.end();}})().catch(e=>{console.error('Migración revertida; revisar acceso y esquema.',e.code||e.name);process.exitCode=1;});
