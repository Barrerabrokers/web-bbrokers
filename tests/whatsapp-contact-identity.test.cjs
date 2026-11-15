const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
function load(file){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>n.startsWith('@/')?load(n.replace('@/','')+'.ts'):require(n),console:{info(){},warn(){}},Date,process:{env:{}}});return module.exports;}
const identity=load('lib/whatsapp-contact-identity.ts');
test('Argentine WhatsApp routing 9 matches same national number without collapsing different numbers',()=>{assert.equal(identity.phoneIdentity('(+54) 9 11 1234-5001'),'541112345001');assert.equal(identity.phoneIdentity('+54 11 12345001'),'541112345001');assert.notEqual(identity.phoneIdentity('+5491112345004'),identity.phoneIdentity('+541112345001'));});
test('Argentine variants retain country and local Buenos Aires mobile notation',()=>{const v=identity.phoneIdentityVariants('+5491112345001');assert.ok(v.international.includes('541112345001'));assert.ok(v.national.includes('1112345001'));assert.ok(v.national.includes('111512345001'));const foreign=identity.phoneIdentityVariants('+341112345001');assert.equal(foreign.national.length,0);assert.ok(!foreign.international.includes('541112345001'));});

test('Business App +54 and Cloud API +549 reuse one thread and preserve its delivery number',async()=>{
 const rows=[];
 const sql=async(strings,...args)=>{
  const query=strings.join('?');
  if(query.includes('SELECT phone FROM crm_whatsapp_conversations'))return rows.filter(row=>args[0].includes(row.phone)&&row.business_phone_number_id===args[1]).map(row=>({phone:row.phone}));
  if(query.includes('INSERT INTO crm_whatsapp_conversations')){
   const [id,phone,,lead,phoneId]=args;let row=rows.find(row=>row.phone===phone);
   if(!row){row={id,phone,lead_id:lead,business_phone_number_id:phoneId,last_message_at:new Date(),status:'open',channel:'whatsapp'};rows.push(row);}
   return [{id:row.id}];
  }
  return [];
 };
 sql.begin=async cb=>cb(sql);sql.end=async()=>{};sql.unsafe=async(query,args)=>query.includes('WHERE c.id =')?rows.filter(row=>row.id===args[0]):[];
 const mocks={postgres:()=>sql,crypto:require('node:crypto'),'@/lib/mia-access':{getMiaAccess:async()=>({mode:'all'})},'@/lib/whatsapp-contact-identity':{...identity,ensureContactIdentitySchema:async()=>{},findContactLead:async()=>({id:'lead'})},'@/lib/whatsapp-send':{WHATSAPP_TEST_PHONE_ID:'test'}};
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/whatsapp-inbox.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:n=>mocks[n]||{},Date,process:{env:{DATABASE_URL:'test'}},console});
 const api=module.exports;
 const inbound=await api.ensureWhatsAppContact('5491112345001','Cliente','official');
 const echo=await api.ensureWhatsAppContact('541112345001','','official');
 assert.equal(rows.length,1);assert.equal(inbound.id,echo.id);assert.equal(echo.phone,'5491112345001');
 const other=await api.ensureWhatsAppContact('5491112345004','Otro','official');assert.notEqual(other.id,inbound.id);assert.equal(rows.length,2);
});
