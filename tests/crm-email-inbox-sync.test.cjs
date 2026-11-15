const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const ts=require('typescript');const fs=require('node:fs');
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function fixture({failSave=false,known=false}={}){
 const stored=[],queries=[],calls=[],seen=new Set();
 const received=Date.now()-120000;
 const messages={one:{id:'one',internalDate:String(received),payload:{headers:[{name:'From',value:'Cliente <client@example.test>'},{name:'Subject',value:'Visita'}],mimeType:'text/plain',body:{data:Buffer.from('Confirmo la visita').toString('base64url')}}},auto:{id:'auto',internalDate:String(received),payload:{headers:[{name:'From',value:'client@example.test'},{name:'Auto-Submitted',value:'auto-replied'}]}},unknown:{id:'unknown',internalDate:String(received),payload:{headers:[{name:'From',value:'stranger@example.test'}]}},invalid:{id:'invalid',internalDate:String(received),payload:{headers:[{name:'From',value:'not an email'}]}}};
 const sql=async(strings,...values)=>{const q=strings.join('?');queries.push({q,values});
  if(q.includes('SELECT a.agent_id'))return [{agent_id:'agent'}];
  if(q.includes('SELECT checked_at'))return [{checked_at:new Date(Date.now()-600000)}];
  if(q.includes('SELECT id FROM crm_activities'))return known||seen.has(values[2])?[{id:'existing'}]:[];
  if(q.includes('SELECT l.id'))return values[0]==='client@example.test'?[{id:'lead'}]:[];
  return [];
 };
 const db={createCrmActivity:async data=>{if(failSave)return {error:'Cannot save'};stored.push(data);seen.add(data.externalId);return {activity:{id:'saved'}};},getCrmEmailAccountWithSecret:async()=>({email:'agent@example.test'})};
 const replyModule={exports:{}};vm.runInNewContext(compile('lib/crm-email-replies.ts'),{module:replyModule,exports:replyModule.exports,Buffer,require:n=>n==='@/lib/db'?db:n==='@/lib/google-oauth'?{}:require(n)});
 const module={exports:{}};vm.runInNewContext(compile('lib/crm-email-inbox-sync.ts'),{module,exports:module.exports,Date,URLSearchParams,AbortSignal,Number,String,encodeURIComponent,console:{error:()=>{}},require:n=>n==='@/lib/db'?db:n==='@/lib/google-oauth'?{getAccessTokenForGoogleAccount:async()=> 'token'}:n==='@/lib/crm-email-replies'?replyModule.exports:require(n),fetch:async(url)=>{calls.push(url);const u=new URL(url);const id=u.pathname.split('/').pop();const data=id==='messages'?(u.searchParams.has('pageToken')?{messages:[{id:'unknown'},{id:'invalid'}]}:{messages:[{id:'one'},{id:'auto'}],nextPageToken:'next'}):messages[id];return {ok:true,json:async()=>data};}});
 return {api:module.exports,sql,stored,queries,calls};
}
test('polls one mailbox with pagination, accepts verified CRM senders, excludes automatic and unrelated messages',async()=>{
 const f=fixture();const result=await f.api.syncRecentCrmReplies(f.sql,'https://barrerabrokers.com');
 assert.equal(result.imported,1);assert.equal(result.failed,0);
 assert.equal(f.stored[0].createdBy,'agent');assert.equal(f.stored[0].leadId,'lead');assert.equal(f.stored[0].externalId,'gmail:agent:one');assert.equal(f.stored[0].body,'Confirmo la visita');
 assert.equal(f.calls.filter(u=>new URL(u).pathname.endsWith('/messages')).length,2);
 assert.ok(f.queries.some(x=>x.q.includes('UPDATE crm_email_inbox_checks')));
});
test('failed storage keeps the mailbox checkpoint for the next retry',async()=>{
 const f=fixture({failSave:true});const result=await f.api.syncRecentCrmReplies(f.sql,'https://barrerabrokers.com');
 assert.equal(result.failed,1);assert.equal(f.queries.some(x=>x.q.includes('UPDATE crm_email_inbox_checks')),false);
});
test('existing messages are deduplicated before fetching their contents',async()=>{
 const f=fixture({known:true});await f.api.syncRecentCrmReplies(f.sql,'https://barrerabrokers.com');
 assert.equal(f.stored.length,0);assert.ok(f.calls.every(u=>new URL(u).pathname.endsWith('/messages')));
});
