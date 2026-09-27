const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,Buffer,Date,console,process:{env:{NEXTAUTH_SECRET:'test-only-secret'}},require:n=>n in mocks?mocks[n]:require(n)});return module.exports;}
const security=load('lib/session-security.ts');
const account={id:'user-1',password:'test-hash-not-a-password',role:'agent',active:true,email:'agent@example.test'};
test('session proof revokes old, expired, disabled and changed-account sessions',()=>{
 const now=Date.now(),token={id:account.id,sessionIssuedAt:now,sessionProof:security.accountSessionProof(account,'test-only-secret')};
 assert.equal(security.validAccountSession(token,account,'test-only-secret',now),true);
 assert.equal(security.validAccountSession(token,account,'test-only-secret',now+8*3600000),false);
 for(const change of [{active:false},{role:'admin'},{password:'changed-hash'},{email:'changed@example.test'},{id:'other'},{sessionVersion:2}])assert.equal(security.validAccountSession(token,{...account,...change},'test-only-secret',now),false);
 assert.equal(security.validAccountSession({id:account.id},account,'test-only-secret',now),false);
 assert.equal(security.validAccountSession(token,null,'test-only-secret',now),false);
});
test('NextAuth decode revalidates the current account and denies database failure',async()=>{
 let current=account;let fail=false;
 const {authOptions}=load('lib/auth.ts',{'@/lib/db':{getAgentById:async()=>{if(fail)throw new Error('offline');return current;},getAgentByEmail:async()=>current},'@/lib/session-security':security,'@/lib/auth-rate-limit':{allowLoginAttempt:async()=>true}});
 const jwt=require('next-auth/jwt'),token={id:account.id,role:'agent',sessionIssuedAt:Date.now(),sessionProof:security.accountSessionProof(account,'test-only-secret')};
 const encrypted=await jwt.encode({token,secret:'test-only-secret'});
 assert.equal((await authOptions.jwt.decode({token:encrypted,secret:'test-only-secret'})).id,account.id);
 current={...account,active:false};assert.equal(await authOptions.jwt.decode({token:encrypted,secret:'test-only-secret'}),null);
 current=account;fail=true;assert.equal(await authOptions.jwt.decode({token:encrypted,secret:'test-only-secret'}),null);
});
test('session refresh neither extends the absolute lifetime nor accepts client roles',async()=>{
 const {authOptions}=load('lib/auth.ts',{'@/lib/db':{},'@/lib/session-security':security,'@/lib/auth-rate-limit':{}});
 const token={id:account.id,role:'agent',sessionIssuedAt:Date.now()-60000,sessionProof:'private-proof'};
 const renewed=await authOptions.callbacks.jwt({token,trigger:'update',session:{role:'admin'}});
 assert.equal(renewed.role,'agent');assert.equal(renewed.sessionIssuedAt,token.sessionIssuedAt);
 const session=await authOptions.callbacks.session({session:{user:{}},token});
 assert.equal(session.user.sessionProof,undefined);assert.equal(Date.parse(session.expires),token.sessionIssuedAt+8*3600000);
});
test('patched mailer encodes attachments without sending mail',async()=>{
 const mailer=require('crm-nodemailer');const result=await mailer.createTransport({streamTransport:true,buffer:true}).sendMail({from:'crm@example.test',to:'client@example.test',subject:'Prueba á',text:'Sin envío externo',attachments:[{filename:'test.txt',content:Buffer.from('test')}]});
 assert.ok(result.message.length>0);assert.match(result.message.toString(),/test.txt/);
});
test('patched spreadsheet package reads back an in-memory XLSX without client data',()=>{
 const xlsx=require('xlsx'),book=xlsx.utils.book_new();xlsx.utils.book_append_sheet(book,xlsx.utils.aoa_to_sheet([['Nombre'],['Prueba']]),'Test');
 const result=xlsx.read(xlsx.write(book,{type:'buffer',bookType:'xlsx'}),{type:'buffer'});
 assert.equal(xlsx.utils.sheet_to_json(result.Sheets.Test)[0].Nombre,'Prueba');
});
