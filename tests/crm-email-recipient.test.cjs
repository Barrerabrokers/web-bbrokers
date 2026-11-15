const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,requireMock=require){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,require:requireMock,Buffer,console,process});return exports;}
const validation=load('lib/crm-email-recipient.ts');
test('requires one real email address, accepting surrounding whitespace',()=>{
 for(const email of [null,undefined,'','   ','Mica','x@','a@example.com,b@example.com','a@example.com\r\nBcc:b@example.com']) assert.equal(validation.hasValidEmailRecipient(email),false);
 assert.equal(validation.hasValidEmailRecipient(' mica@example.com '),true);
});
test('individual and marketing sends stop before credentials, tracking or network for missing recipients',async()=>{
 const sender=load('lib/crm-email-sender.ts',name=>{
   if(name==='@/lib/crm-email-recipient')return validation;
   if(name==='@/lib/db')return new Proxy({},{get:()=>()=>{throw Error('must not access database')}});
   return {};
 });
 const result=await sender.sendCrmEmail({lead:{id:'lead',email:''},agentId:'agent',subject:'Hola',body:'Hola'});
 assert.equal(result.sent,false);assert.equal(result.error,validation.MISSING_RECIPIENT_MESSAGE);
 await assert.rejects(sender.sendPrivateClientEmail({agentId:'agent',email:' ',subject:'Hola',body:'Hola'}),{message:validation.MISSING_RECIPIENT_MESSAGE});
});
