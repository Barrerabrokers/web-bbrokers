const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');const postgres=require('postgres');
const enabled=process.env.RUN_DB_TESTS==='1';if(enabled)require('@next/env').loadEnvConfig(process.cwd());
function load(file,mocks={}){const mod={exports:{}};const source=fs.readFileSync(file,'utf8').replaceAll('storage.objects','storage_test_objects');vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:mod,exports:mod.exports,require:n=>mocks[n]||require(n),process});return mod.exports;}
test('storage reservations account for pending uploads without counting finished files twice; worker leases are exclusive and recover after expiry',{skip:!enabled},async()=>{
 const db=postgres(process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.DATABASE_URL,{ssl:'require',max:1,prepare:false});const old=process.env.STORAGE_BUDGET_BYTES;process.env.STORAGE_BUDGET_BYTES='1000';
 try{await db.begin(async tx=>{
  await tx.unsafe(`CREATE TEMP TABLE storage_test_objects(bucket_id text,name text,metadata jsonb) ON COMMIT DROP; CREATE TEMP TABLE storage_upload_reservations(path text PRIMARY KEY,bytes bigint,expires_at timestamptz) ON COMMIT DROP; CREATE TEMP TABLE database_worker_leases(worker_key text PRIMARY KEY,owner uuid,lease_until timestamptz) ON COMMIT DROP`);
  const facade=(strings,...values)=>tx.unsafe(strings.reduce((q,s,i)=>q+(i?'$'+i:'')+s,''),values);facade.begin=fn=>fn(facade);
  const budget=load('lib/storage-budget.ts',{'@/lib/database-pool':{getSharedDatabase:()=>facade}});
  await tx`INSERT INTO storage_test_objects VALUES('properties','existing.pdf','{"size":600}')`;
  await budget.reserveStorageUpload('new.pdf',300,facade);
  await assert.rejects(()=>budget.reserveStorageUpload('over.pdf',200,facade),/límite preventivo/);
  await tx`INSERT INTO storage_test_objects VALUES('properties','new.pdf','{"size":300}')`;
  await budget.reserveStorageUpload('tiny.pdf',50,facade);
  await budget.releaseStorageReservation('tiny.pdf');
  await tx`UPDATE storage_upload_reservations SET expires_at=NOW()-INTERVAL '1 second' WHERE path='new.pdf'`;
  await budget.reserveStorageUpload('last.pdf',100,facade);
  assert.equal((await tx`SELECT count(*)::int n FROM storage_upload_reservations`)[0].n,1);
  const leases=load('lib/database-worker-lease.ts');const a=await leases.acquireWorkerLease(facade,'test');assert.ok(a);assert.equal(await leases.acquireWorkerLease(facade,'test'),null);
  await tx`UPDATE database_worker_leases SET lease_until=NOW()-INTERVAL '1 second'`;
  const b=await leases.acquireWorkerLease(facade,'test');assert.ok(b&&b!==a);await leases.releaseWorkerLease(facade,'test',a);assert.equal(await leases.acquireWorkerLease(facade,'test'),null);await leases.releaseWorkerLease(facade,'test',b);assert.ok(await leases.acquireWorkerLease(facade,'test'));
 });}finally{if(old)process.env.STORAGE_BUDGET_BYTES=old;else delete process.env.STORAGE_BUDGET_BYTES;await db.end();}
});
