const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const vm=require('node:vm');
const fs=require('node:fs');
const code=ts.transpileModule(fs.readFileSync('lib/crm-push.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
function fixture(statusCode, meetingOutcome=false){
 const queries=[],sends=[],delivered=new Set();let removed=false;
 const sql=async(strings,...values)=>{
  const q=strings.join('?');queries.push({q,values});
  if(q.includes('SELECT public_key'))return [{public_key:'public',private_key:'private'}];
  if(q.includes('pg_try_advisory_lock'))return [{acquired:true}];
  if(q.includes('SELECT s.*'))return removed?[]:[{id:'device',agent_id:'agent',endpoint:'https://fcm.googleapis.com/test',p256dh:'key',auth:'auth',created_at:new Date(),email_opens:true,tasks:true,meetings:true,meeting_minutes:720}];
  if(q.includes('to_regclass'))return [{tasks:true,bookings:true}];
  if(q.includes("SELECT 'open:'")&&!meetingOutcome)return [{event_key:'open:1',kind:'open',href:'/admin/crm/contact',event_at:new Date(),expires_at:new Date(Date.now()+3600000)}];
  if(q.includes("SELECT 'meeting-outcome:'")&&meetingOutcome)return [{event_key:'meeting-outcome:1:today',kind:'meeting_outcome',href:'/admin/crm/contact?activity=reunion#reuniones-crm',event_at:new Date(),expires_at:new Date(Date.now()+3600000)}];
  if(q.includes('SELECT event_key'))return [...delivered].map(event_key=>({event_key}));
  if(q.includes('SET sent_at=NOW()'))delivered.add(values[1]);
  if(q.includes('DELETE FROM crm_push_subscriptions'))removed=true;
  return [];
 };
 sql.unsafe=async()=>[];sql.end=async()=>{};
 const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,Date,URL,Set,console,process:{env:{DATABASE_URL:'mock'}},require:n=>n==='@/lib/crm-meeting-lifecycle'?{ensureMeetingLifecycle:async()=>{}}:n==='postgres'?{default:()=>sql}:n==='web-push'?{default:{sendNotification:async(...args)=>{sends.push(args);if(statusCode)throw {statusCode};}}}:require(n)});
 return {api:module.exports,queries,sends};
}
test('only trusted HTTPS push providers are allowed',()=>{
 const {api}=fixture();
 for(const url of ['https://fcm.googleapis.com/fcm/send/key','https://updates.push.services.mozilla.com/wpush/v2/key','https://web.push.apple.com/key'])assert.equal(api.validPushEndpoint(url),true);
 for(const url of ['http://fcm.googleapis.com/key','https://127.0.0.1/key','https://fcm.googleapis.com.evil.test/key','https://user:secret@fcm.googleapis.com/key','https://fcm.googleapis.com:8443/key','https://evil.test/key'])assert.equal(api.validPushEndpoint(url),false);
});
test('successful events are deduplicated; phone payload contains no customer details',async()=>{
 const {api,sends,queries}=fixture();await api.processCrmPush();await api.processCrmPush();
 assert.equal(sends.length,1);
 const body=JSON.parse(sends[0][1]);assert.equal(body.title,'Un cliente abrió tu correo');assert.equal(body.href,'/admin/crm/contact');
 assert.equal(body.body,'Abrí el CRM para ver el contacto.');
 for(const kind of ["SELECT 'open:'","SELECT 'task:'","SELECT 'meeting:'","SELECT 'booking:'"]){const q=queries.find(x=>x.q.includes(kind));assert.ok(q);assert.ok(q.values.includes('agent'));}
 assert.ok(queries.find(x=>x.q.includes("COALESCE(s.reminder_minutes,60)")));
});
test('expired push endpoints are removed; transport failures retain subscription for retry',async()=>{
 for(const code of [404,410,503]){
  const {api,queries}=fixture(code);const result=await api.processCrmPush();
  assert.equal(result.expired,code===503?0:1);assert.equal(result.failed,code===503?1:0);
  assert.equal(queries.some(x=>x.q.includes('DELETE FROM crm_push_subscriptions')),code!==503);
  assert.ok(queries.some(x=>x.q.includes("INTERVAL '5 minutes'")));
 }
});
test('meeting outcome alerts target the owner, exclude recorded outcomes and deduplicate each day',async()=>{
 const {api,sends,queries}=fixture(undefined,true);
 await api.processCrmPush();await api.processCrmPush();
 assert.equal(sends.length,1);
 const body=JSON.parse(sends[0][1]);assert.equal(body.title,'Resultado de reunión pendiente');
 assert.equal(body.href,'/admin/crm/contact?activity=reunion#reuniones-crm');
 const query=queries.find(x=>x.q.includes("SELECT 'meeting-outcome:'"));
 assert.ok(query.values.includes('agent'));
 assert.match(query.q,/CURRENT_DATE/);
 assert.match(query.q,/s.ends_at<=NOW\(\) OR s.cancelled_at IS NOT NULL/);
 assert.match(query.q,/TRIM\(r.outcome\)/);
});
test('service worker rejects off-site and non-CRM notification destinations',async()=>{
 const events={},notices=[];
 const self={location:{origin:'https://barrerabrokers.com'},addEventListener:(name,fn)=>events[name]=fn,registration:{showNotification:async(...args)=>notices.push(args)}};
 const context={self,URL};vm.createContext(context);vm.runInContext(fs.readFileSync('public/sw.js','utf8'),context);
 for(const href of ['https://evil.test','javascript:alert(1)','/api/crm','//evil.test'])assert.equal(context.crmNotificationUrl(href),'https://barrerabrokers.com/admin/crm');
 assert.equal(context.crmNotificationUrl('/admin/crm/123?activity=tarea'),'https://barrerabrokers.com/admin/crm/123?activity=tarea');
 let work;events.push({data:{json:()=>({title:'Test',href:'https://evil.test'})},waitUntil:p=>work=p});await work;
 assert.equal(notices[0][1].data.href,'https://barrerabrokers.com/admin/crm');
});
