require('@next/env').loadEnvConfig(process.cwd());
const fs=require('fs'),path=require('path'),postgres=require('postgres');
const connection=process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.POSTGRES_URL_NON_POOLING||process.env.DATABASE_URL||process.env.SUPABASE_DB_URL;
if(!connection)throw Error('Falta configurar la conexión de datos');
const sql=postgres(connection,{ssl:'require',prepare:false,max:1,connect_timeout:10});
(async()=>{try{await sql.begin(tx=>tx.unsafe(fs.readFileSync(path.join(__dirname,'../migrations/20261026_blog.sql'),'utf8')));console.log('Tabla e índice del blog preparados.')}finally{await sql.end()}})().catch(e=>{console.error('No se pudo preparar el blog:',e.code||e.message);process.exitCode=1});
