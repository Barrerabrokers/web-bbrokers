const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const {NextRequest}=require('next/server');
function load(path,mocks={}){
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:n=>n in mocks?mocks[n]:require(n)});
 return module.exports;
}
test('database initialization is permanently retired for both methods without database imports',async()=>{
 const route=load('app/api/init-db/route.ts');
 for(const method of ['GET','POST']){const response=await route[method]();assert.equal(response.status,410);assert.equal(response.headers.get('cache-control'),'no-store');}
 const source=fs.readFileSync('app/api/init-db/route.ts','utf8');assert.doesNotMatch(source,/postgres|DROP TABLE|admin123|SUPABASE_SERVICE_ROLE_KEY/);
});
function uploadFixture(role,validMobile=false){
 const calls=[];
 const api=load('app/api/upload/authorize/route.ts',{
  'next-auth':{getServerSession:async()=>role?{user:{id:'agent',role}}:null},
  '@/lib/auth':{authOptions:{}},
  '@/lib/roles':{canManageListings:role=>['admin','agent','marketing'].includes(role)},
  '@/lib/db':{getMobileUploadSessionFiles:async()=>({files:validMobile?[]:null,expired:!validMobile,error:null})},
  '@/lib/supabase':{getServerSupabase:()=>({storage:{from:()=>({createSignedUploadUrl:async(path,options)=>{calls.push({path,options});return {data:{path,token:'signed-test'}};}})}})},
 });
 const request=(body,origin='https://barrerabrokers.com')=>new NextRequest('https://barrerabrokers.com/api/upload/authorize',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 return {api,calls,request};
}
test('anonymous, cross-origin, invalid paths and expired QR links cannot authorize uploads',async()=>{
 for(const input of [
  {role:null,body:{path:'photo.jpg',size:100}},
  {role:'admin',origin:'https://evil.test',body:{path:'photo.jpg',size:100}},
  {role:'agent',body:{path:'../photo.jpg',size:100}},
  {role:'agent',body:{path:'photo.html',size:100}},
  {role:null,body:{path:'mobile-photo.jpg',size:100,sessionId:'00000000-0000-4000-8000-000000000001'}},
 ]){const f=uploadFixture(input.role);const r=await f.api.POST(f.request(input.body,input.origin));assert.ok(r.status>=400);assert.equal(f.calls.length,0);}
});
test('authorized agent receives a path-bound token with overwrite disabled',async()=>{
 const f=uploadFixture('agent');const r=await f.api.POST(f.request({path:'brochures/photo.pdf',size:100}));
 assert.equal(r.status,200);assert.equal(f.calls[0].path,'brochures/photo.pdf');assert.equal(f.calls[0].options.upsert,false);assert.match(r.headers.get('cache-control'),/no-store/);
});
test('valid QR capability allows only mobile media paths',async()=>{
 const f=uploadFixture(null,true);const sessionId='00000000-0000-4000-8000-000000000001';
 assert.equal((await f.api.POST(f.request({path:'mobile-photo.jpg',size:100,sessionId}))).status,200);
 assert.equal((await f.api.POST(f.request({path:'brochures/other.pdf',size:100,sessionId}))).status,403);
});
