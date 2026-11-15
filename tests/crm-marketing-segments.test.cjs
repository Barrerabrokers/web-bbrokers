const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function setup(user={user:{role:'admin',id:'admin-id'}}){
 const calls=[];const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/crm/clients/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,require:id=>({
  'next/server':{NextResponse:{json:(d,o)=>Response.json(d,o)}},'next-auth':{getServerSession:async()=>user},'@/lib/auth':{authOptions:{}},
  '@/lib/crm-clients':{importClientsByLeadSegment:async(filters,actor)=>{calls.push({filters,actor});return {listName:filters.listName,total:2}},getClientLeadStatuses:async()=>[],getClientLeadSegments:async()=>[{status:'Interesado',development:'Aguilar Point',eligible:2}]},
 }[id]||require(id))});return {...module.exports,calls};
}
function req(body){return new Request('https://example.test/api/crm/clients',{method:'POST',body:JSON.stringify(body)});}
const body={action:'import-segment',status:'Interesado',development:'Aguilar Point',listName:'Interesados · Aguilar Point',confirmed:true};
test('accepts status, development, and combined filters and retains actor identity',async()=>{
 for(const filters of [body,{...body,status:''},{...body,development:''}]){const r=setup();const res=await r.POST(req(filters));assert.equal(res.status,200);assert.equal(r.calls[0].filters.development,filters.development);assert.equal(r.calls[0].actor,'admin-id');}
});
test('rejects missing filters, confirmation, long names, and non-admin access before import',async()=>{
 for(const input of [{...body,status:'',development:''},{...body,confirmed:false},{...body,listName:'x'.repeat(121)}]){const r=setup();assert.equal((await r.POST(req(input))).status,400);assert.equal(r.calls.length,0);}
 for(const user of [null,{user:{role:'agent'}}]){const r=setup(user);assert.equal((await r.POST(req(body))).status,403);assert.equal(r.calls.length,0);}
});
test('returns segment counts alongside legacy status options',async()=>{const r=setup();const response=await r.GET({nextUrl:new URL('https://example.test/api/crm/clients?statuses=1')});assert.equal(response.status,200);assert.equal((await response.json()).segments[0].eligible,2);});
test('creates a list by activity alone or combined with status and development',async()=>{
 for(const filters of [{...body,status:'',development:'',occupation:'Anestesiólogo'},{...body,occupation:'Anestesiología'}]){
  const r=setup();const response=await r.POST(req(filters));assert.equal(response.status,200);assert.equal(r.calls[0].filters.occupation,filters.occupation);assert.equal(r.calls[0].actor,'admin-id');
 }
});
test('activity filtering rejects oversized values and still requires a filter and authorized administrator',async()=>{
 for(const filters of [{...body,status:'',development:'',occupation:' '},{...body,occupation:'x'.repeat(201)}]){
  const r=setup();assert.equal((await r.POST(req(filters))).status,400);assert.equal(r.calls.length,0);
 }
 for(const user of [null,{user:{role:'agent'}}]){const r=setup(user);assert.equal((await r.POST(req({...body,status:'',development:'',occupation:'Anestesiólogo'}))).status,403);assert.equal(r.calls.length,0);}
});
