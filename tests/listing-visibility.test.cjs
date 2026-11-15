const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const box={exports:{},console,Buffer,process,URL,require:name=>name in mocks?mocks[name]:name.startsWith('@/')?{}:require(name)};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,box);return box.exports;}
const roles=load('lib/roles.ts');
const policy=load('lib/listing-visibility-policy.ts',{'@/lib/roles':roles});
const share=load('lib/share-token.ts');
const nextServer={NextResponse:{json:(body,options={})=>({body,status:options.status||200,headers:options.headers})}};
test('catalog visibility is role-scoped and public users cannot request hidden listings',()=>{
 for(const role of [null,'customer','unknown']){assert.equal(policy.listingVisibilityForRole(role,'agents'),'public');assert.equal(policy.canReadListing('agents',role),false);}
 for(const role of ['agent','admin','marketing']){assert.equal(policy.listingVisibilityForRole(role),undefined);assert.equal(policy.canReadListing('agents',role),true);}
 assert.equal(policy.canReadListing('agents',null,true),true);
});
test('signed links allow only their listing and reject tampering or extra segments',()=>{
 const token=share.createShareToken('property','one');
 assert.equal(share.hasValidShareToken(token,'property','one'),true);
 for(const [value,kind,id] of [[token,'property','two'],[token,'development','one'],[token+'x','property','one'],[token+'.extra','property','one']])assert.equal(share.hasValidShareToken(value,kind,id),false);
 assert.ok(share.withShareParam('/propiedades/one#contact',token).endsWith('#contact'));
});
test('both catalog APIs force public visibility without an agent session, including forged filters',async()=>{
 for(const kind of ['properties','developments']) for(const role of [null,'customer','agent']){
  let filter;
  const mocks={'next/server':nextServer,'next-auth':{getServerSession:async()=>role?{user:{role}}:null},'@/lib/listing-visibility-policy':policy,'@/lib/roles':roles};
  mocks[kind==='properties'?'@/lib/db':'@/lib/developments-db']={ [kind==='properties'?'getProperties':'getDevelopments']:async input=>{filter=input;return[]}};
  const route=load(`app/api/${kind}/route.ts`,mocks);
  const response=await route.GET({nextUrl:new URL('https://example.test/api/'+kind+'?visibility=agents')});
  assert.equal(response.status,200);assert.equal(filter.visibility,role==='agent'?'agents':'public');
  assert.equal(response.headers['Cache-Control'],'private, no-store');
 }
});
test('home visibility follows authenticated agents and public visitors',async()=>{
 for(const role of [null,'agent','admin','customer']){
  const access=load('lib/listing-access.ts',{'react':{cache:fn=>fn},'next-auth':{getServerSession:async()=>role?{user:{role}}:null},'@/lib/listing-visibility-policy':policy});
  assert.equal(await access.getListingVisibilityFilter(),roles.canManageListings(role)?undefined:'public');
 }
});
test('hidden pages give shared links useful previews while excluding them from indexing',async()=>{
 for(const [kind,file,key] of [['property','app/propiedades/[id]/page.tsx','id'],['development','app/desarrollos/[slug]/page.tsx','slug']]){
  const hidden={id:'one',visibility:'agents',slug:'hidden',name:'Privado',title:'Privada',description:'Descripción',location:'Buenos Aires',address:'Dirección',images:kind==='property'?['https://example.test/photo.jpg']:[{url:'https://example.test/photo.jpg',isPrimary:true}]};
  const mocks={'next-auth':{getServerSession:async()=>null},'@/lib/listing-visibility-policy':policy,'@/lib/roles':roles,'@/lib/share-token':share,'@/lib/seo':{absoluteUrl:path=>'https://example.test'+path,truncateDescription:text=>text}};
  mocks[kind==='property'?'@/lib/db':'@/lib/developments-db']={ [kind==='property'?'getPropertyById':'getDevelopmentBySlug']:async()=>hidden};
  const page=load(file,mocks);
  const params=Promise.resolve({[key]:'one'});
  const blocked=await page.generateMetadata({params});assert.ok(blocked.title.includes('no encontrad'));
  const metadata=await page.generateMetadata({params,searchParams:Promise.resolve({share:share.createShareToken(kind,'one')})});
  assert.equal(metadata.robots.index,false);assert.equal(metadata.openGraph.images.length,1);assert.ok(!metadata.title.includes('no encontrad'));
 }
});
test('hidden units cannot be enumerated without a matching development link',async()=>{
 const id='one';let reads=0;
 const route=load('app/api/units/route.ts',{'next/server':nextServer,'next-auth':{getServerSession:async()=>null},'@/lib/listing-visibility-policy':policy,'@/lib/share-token':share,'@/lib/roles':roles,'@/lib/developments-db':{getDevelopmentById:async()=>({id,visibility:'agents'}),getUnitsByDevelopment:async()=>{reads++;return[]}}});
 const request=token=>({nextUrl:new URL('https://example.test/api/units?developmentId=one'+(token?'&share='+token:''))});
 assert.equal((await route.GET(request())).status,404);assert.equal(reads,0);
 assert.equal((await route.GET(request(share.createShareToken('development','different')))).status,404);assert.equal(reads,0);
 assert.equal((await route.GET(request(share.createShareToken('development',id)))).status,200);assert.equal(reads,1);
});
