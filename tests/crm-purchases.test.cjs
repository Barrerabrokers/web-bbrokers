const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const path=require('node:path');
function load(file,mocks={}) { const box={exports:{},console,require:name=>name in mocks?mocks[name]:require(name)};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,box);return box.exports; }
const helpers=load('lib/crm-purchases.ts');
const purchase={type:'VENTA',development:'Junín',units:['401'],date:'2026-10-09',price:100000,advance:30000,balance:65000};
const history=()=>({operations:[purchase],source:'Excel',address:'Castro 841'});
test('purchase validation: real date, positive USD, cents, nonempty and unique units',()=>{
 assert.equal(helpers.purchaseSchema.safeParse(purchase).success,true);
 for(const override of [{date:'2026-02-30'},{price:-1},{balance:NaN},{advance:1.111},{units:[]},{units:['401','401']},{development:''}])assert.equal(helpers.purchaseSchema.safeParse({...purchase,...override}).success,false);
});
test('create, edit and delete preserve original import metadata and audit, without recalculating confirmed balance',()=>{
 let data=helpers.applyPurchaseChange(history(),{action:'add',purchase:{...purchase,units:['402']}},'admin','now');assert.equal(data.operations.length,2);assert.equal(data.operations[1].balance,65000);
 data=helpers.applyPurchaseChange(data,{action:'edit',index:1,purchase:{...purchase,units:['403'],balance:123}},'admin','now');assert.equal(data.operations[1].balance,123);
 data=helpers.applyPurchaseChange(data,{action:'delete',index:0,unitIndex:0},'admin','now');assert.equal(data.operations.length,1);assert.equal(data.address,'Castro 841');assert.equal(data.audit.length,3);assert.equal(data.audit[2].before.units[0],'401');
});
test('removing units from a collective purchase never turns the collective amount into an individual allocation',()=>{
 let data=helpers.readPurchaseHistory(JSON.stringify({operations:[{...purchase,units:['401','402']}]}));
 data=helpers.applyPurchaseChange(data,{action:'delete',index:0,unitIndex:0},'admin','now');assert.equal(data.operations[0].collective,true);assert.equal(data.operations[0].price,100000);assert.equal(data.operations[0].units.length,1);
 assert.throws(()=>helpers.applyPurchaseChange(data,{action:'delete',index:4,unitIndex:0},'admin','now'));
});
test('API permits administrators only, ignores client permissions, and validates before writing',async()=>{
 for(const role of [null,'agent','marketing','admin']) {
  let calls=0;const route=load('app/api/crm/purchases/route.ts',{'next/server':{after:()=>{},NextResponse:{json:(body,options)=>({body,status:options.status})}},'next-auth':{getServerSession:async()=>role?{user:{role,id:'actor'}}:null},'@/lib/auth':{authOptions:{}},'@/lib/crm-reservation-calendar':{},'@/lib/crm-purchases':helpers,'@/lib/crm-purchases-store':{saveCrmPurchaseChange:async()=>{calls++;return{status:200,version:'saved'}}}});
  const result=await route.POST({json:async()=>({leadId:'3585a706-96e8-46d7-b207-cb9912bf4f3c',version:null,canEdit:true,change:{action:'add',purchase}})});
  assert.equal(result.status,role==='admin'?200:403);assert.equal(calls,role==='admin'?1:0);
  if(role==='admin'){const invalid=await route.POST({json:async()=>({leadId:'invalid'})});assert.equal(invalid.status,400);assert.equal(calls,1);}
 }
});
test('read-only rendering has amounts and no purchase editing controls; empty admin contacts can add units',()=>{
 const React=require('react'),render=require('react-dom/server').renderToStaticMarkup;
 const component=load('components/admin/crm-purchase-history.tsx',{'next/navigation':{useRouter:()=>({refresh(){}})},'@/lib/crm-purchases':helpers,'@/lib/argentina-time':load('lib/argentina-time.ts')}).CrmPurchaseHistory;
 const readonly=render(React.createElement(component,{leadId:'test',value:JSON.stringify(history()),canEdit:false}));
 assert.ok(readonly.includes('USD 65.000'));assert.ok(readonly.includes('>Saldo<'));assert.ok(!readonly.includes('Saldo inicial'));for(const label of ['Agregar unidad','Editar compra','Borrar unidad'])assert.ok(!readonly.includes(label));
 const admin=render(React.createElement(component,{leadId:'test',value:null,canEdit:true}));assert.ok(admin.includes('Agregar unidad'));
});
test('incomplete historical purchases preserve unknown amounts, dates and all source operation types',()=>{
 for(const type of ['VENTA','REVENTA','USADO','RESERVA']) {
  const imported={...purchase,type,date:null,price:null,advance:null,balance:null,source_rows:[213]};
  const data=helpers.readPurchaseHistory(JSON.stringify({operations:[imported],imported_contacts:[{name:'Comprador',email:'a@example.com b@example.com'}]}));
  assert.equal(data.operations[0].price,null);assert.equal(data.operations[0].balance,null);assert.equal(data.operations[0].source_rows[0],213);
  const React=require('react'),render=require('react-dom/server').renderToStaticMarkup;
  const component=load('components/admin/crm-purchase-history.tsx',{'next/navigation':{useRouter:()=>({refresh(){}})},'@/lib/crm-purchases':helpers,'@/lib/argentina-time':load('lib/argentina-time.ts')}).CrmPurchaseHistory;
  const html=render(React.createElement(component,{leadId:'test',value:JSON.stringify(data),canEdit:false}));assert.ok(html.includes('No informado'));assert.ok(html.includes('No informada'));assert.ok(html.includes('a@example.com b@example.com'));assert.ok(!html.includes('USD 0'));
 }
});
