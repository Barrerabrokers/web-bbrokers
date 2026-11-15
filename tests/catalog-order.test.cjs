const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}) {const box={exports:{},console,Map,require:name=>name in mocks?mocks[name]:name.startsWith('@/')?{}:require(name)};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,box);return box.exports;}
const helper=load('lib/catalog-order.ts');
const A='00000000-0000-0000-0000-000000000001',B='00000000-0000-0000-0000-000000000002',H='00000000-0000-0000-0000-000000000003';
test('reorder must include every listing exactly once, including hidden listings',()=>{
 assert.equal(helper.catalogOrderSchema.safeParse({kind:'properties',version:[A,B,H],ids:[H,B,A]}).success,true);
 for(const ids of [[A,A,H],[A,B],[A,B,'00000000-0000-0000-0000-000000000009']])assert.equal(helper.catalogOrderSchema.safeParse({kind:'properties',version:[A,B,H],ids}).success,false);
 assert.equal(helper.catalogOrderSchema.safeParse({kind:'unknown',version:[A],ids:[A]}).success,false);
});
test('API uses session permissions, rejects agents and anonymous requests and validates before saving',async()=>{
 for(const role of [null,'agent','admin','marketing']){
  let writes=0;
  const route=load('app/api/catalog/order/route.ts',{'next/server':{NextResponse:{json:(body,options)=>({body,status:options.status})}},'next-auth':{getServerSession:async()=>role?{user:{role}}:null},'next/cache':{revalidatePath(){}},'@/lib/roles':load('lib/roles.ts'),'@/lib/catalog-order':helper,'@/lib/catalog-order-store':{saveCatalogOrder:async()=>{writes++;return{status:200}}}});
  const response=await route.POST({json:async()=>({kind:'developments',ids:[B,A],version:[A,B],canEdit:true})});
  assert.equal(response.status,['admin','marketing'].includes(role)?200:403);assert.equal(writes,['admin','marketing'].includes(role)?1:0);
  if(role==='admin'){assert.equal((await route.POST({json:async()=>({kind:'properties',version:[A,B],ids:[A,A]})})).status,400);assert.equal(writes,1);}
 }
});
test('a concurrently changed or expanded catalog rejects stale saves without modifying order',async()=>{
 let writes=0;
 const tx=async strings=>{const query=strings.join('?');if(query.includes('SELECT id'))return[{id:B},{id:A},{id:H}];if(query.includes('UPDATE'))writes++;return[]};
 const store=load('lib/catalog-order-store.ts',{'@/lib/database-pool':{getSharedDatabase:()=>({begin:fn=>fn(tx)}),releaseSharedDatabase:async()=>{}},'@/lib/catalog-order':helper});
 assert.equal((await store.saveCatalogOrder({kind:'properties',ids:[B,A,H],version:[A,B,H]})).status,409);
 assert.equal((await store.saveCatalogOrder({kind:'properties',ids:[B,A],version:[A,B]})).status,409);
 assert.equal(writes,0);
});
test('public query functions prioritize manual order before creation date',()=>{
 assert.match(fs.readFileSync('lib/db.ts','utf8'),/ORDER BY p.sort_order ASC NULLS LAST, p.created_at DESC, p.id ASC/);
 assert.match(fs.readFileSync('lib/developments-db.ts','utf8'),/ORDER BY d.sort_order ASC NULLS LAST, d.created_at DESC, d.id ASC/);
});
test('read-only users receive cards without reorder controls',()=>{
 const React=require('react'),render=require('react-dom/server').renderToStaticMarkup;
 const component=load('components/admin/sortable-catalog.tsx').SortableCatalog;
 const items=[{id:A,label:'Primero'},{id:B,label:'Segundo'}];
 const props={kind:'properties',items,className:'space-y-3',children:[React.createElement('div',{key:A},'Primero'),React.createElement('div',{key:B},'Segundo')]};
 const readonly=render(React.createElement(component,{...props,canEdit:false}));assert.ok(!readonly.includes('Ordenar catálogo'));assert.ok(readonly.includes('Primero'));assert.ok(readonly.includes('Segundo'));
 const admin=render(React.createElement(component,{...props,canEdit:true}));assert.ok(admin.includes('Ordenar catálogo'));
});
test('real PostgreSQL reorder is atomic, public filters retain relative order, and inserts/deletes invalidate versions',{skip:process.env.RUN_DB_TESTS!=='1'},async()=>{
 require('@next/env').loadEnvConfig(process.cwd());const postgres=require('postgres');const sql=postgres(process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.DATABASE_URL||process.env.SUPABASE_DB_URL,{ssl:'require',max:1,prepare:false});
 try {await sql.begin(async tx=>{
  await tx.unsafe('CREATE TEMP TABLE properties(id UUID PRIMARY KEY,created_at TIMESTAMPTZ,sort_order INTEGER,visibility TEXT) ON COMMIT DROP; CREATE TEMP TABLE developments(LIKE properties INCLUDING ALL) ON COMMIT DROP;');
  const store=load('lib/catalog-order-store.ts',{'@/lib/database-pool':{getSharedDatabase:()=>({begin:fn=>fn(tx)}),releaseSharedDatabase:async()=>{}},'@/lib/catalog-order':helper});
  for(const kind of ['properties','developments']){
   await tx.unsafe(`INSERT INTO ${kind} VALUES($1,NOW(),0,'public'),($2,NOW(),1,'public'),($3,NOW(),2,'agents')`,[A,B,H]);
   const result=await store.saveCatalogOrder({kind,version:[A,B,H],ids:[H,B,A]});assert.equal(result.status,200);
   const all=await tx.unsafe(`SELECT id FROM ${kind} ORDER BY sort_order ASC NULLS LAST,created_at DESC,id ASC`);assert.deepEqual(all.map(row=>row.id),[H,B,A]);
   const visible=await tx.unsafe(`SELECT id FROM ${kind} WHERE visibility='public' ORDER BY sort_order ASC NULLS LAST,created_at DESC,id ASC`);assert.deepEqual(visible.map(row=>row.id),[B,A]);
   assert.equal((await store.saveCatalogOrder({kind,version:[A,B,H],ids:[B,A,H]})).status,409);
   await tx.unsafe(`INSERT INTO ${kind} VALUES('00000000-0000-0000-0000-000000000004',NOW(),NULL,'public')`);
   assert.equal((await store.saveCatalogOrder({kind,version:[H,B,A],ids:[A,B,H]})).status,409);
   await tx.unsafe(`DELETE FROM ${kind} WHERE id=$1`,[A]);
   assert.equal((await store.saveCatalogOrder({kind,version:[H,B,A],ids:[A,B,H]})).status,409);
  }
  throw Error('ROLLBACK_TEST');
 })}catch(error){if(error.message!=='ROLLBACK_TEST')throw error;}finally{await sql.end();}
});
