const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const crypto=require('node:crypto');
const leadId='00000000-0000-4000-8000-000000000001';
async function scenario(input={},options={}) {
 const sent=[],saved=[];
 const lead={id:leadId,firstName:'Cliente',lastName:'Prueba',email:options.noEmail?'':'cliente@example.com',phone:'123',countryCode:'+54'};
 const mocks={
  'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init)}},
  'next-auth':{getServerSession:async()=>({user:{id:'agent',role:'agent'}})},
  '@/lib/auth':{authOptions:{}},
  '@/lib/google-calendar-connection':{hasGoogleCalendarAccess:()=>true},
  '@/lib/db':{getCrmEmailAccountWithSecret:async()=>({}),getCrmLeads:async()=>options.denied?[]:[lead],getAgentByEmail:async email=>({id:email.split('@')[0],email,name:email.startsWith('lucas')?'Lucas':'Pablo',active:true}),createCrmActivity:async data=>{saved.push(data);return {activity:{id:'activity',...data}};}},
  '@/lib/google-oauth':{getAccessTokenForGoogleAccount:async()=>'fake'},
  '@/lib/crm-calendar-availability':{getCrmCalendarBusy:async()=>[]},
  '@/lib/roles':{canManageListings:()=>true,canViewAllCrmContacts:()=>false},
  '@/app/api/crm/activities/route':{POST:async()=>Response.json({task:true})},
  '@/lib/crm-meeting-lifecycle':{registerScheduledMeeting:async()=>{}},
 };
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/crm/calendar/events/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{
  module,exports:module.exports,require:id=>id in mocks?mocks[id]:require(id),process,console,crypto,URL,
  fetch:async(url,init)=>{sent.push({url,body:JSON.parse(init.body)});return Response.json({id:'google-event',htmlLink:'https://calendar.google.com/event'});}
 });
 const response=await module.exports.POST(new Request('https://crm.example.com/api/crm/calendar/events',{method:'POST',body:JSON.stringify({leadId,type:'reunion',title:'Reunión comercial',body:'NOTA PRIVADA: presupuesto y estrategia',scheduledAt:new Date(Date.now()+86400000).toISOString(),meetingMode:'in_person',location:'Oficina',...input})}));
 return {response,sent,saved};
}
test('meetings allow only 30 or 60 minutes and default to 60',async()=>{
 for (const duration of [undefined,30,60]) {
  const {response,sent}=await scenario({duration,sendClientInvitation:false});
  assert.equal(response.status,200);
  assert.equal((Date.parse(sent[0].body.end.dateTime)-Date.parse(sent[0].body.start.dateTime))/60000,duration??60);
 }
 for (const duration of [15,45,90,120,null,'30']) {
  const {response,sent,saved}=await scenario({duration,sendClientInvitation:false});
  assert.equal(response.status,400);assert.equal(sent.length,0);assert.equal(saved.length,0);
 }
 const {response}=await scenario({type:'tarea',duration:45});
 assert.equal(response.status,200);assert.equal((await response.json()).task,true);
});
test('Pablo and Lucas are independent invitations without exposing internal notes',async()=>{
 for(const [includePablo,includeLucas] of [[false,false],[true,false],[false,true],[true,true]]) {
  const {response,sent}=await scenario({includePablo,includeLucas,sendClientInvitation:false});
  assert.equal(response.status,200);
  assert.deepEqual(sent[0].body.attendees.map(a=>a.email),[...(includePablo?['pablo@barrerabrokers.com']:[]),...(includeLucas?['lucas@barrerabrokers.com']:[])]);
  assert.doesNotMatch(JSON.stringify(sent),/NOTA PRIVADA|presupuesto|estrategia/);
 }
});
test('requires explicit client invitation choice before external writes',async()=>{
 for(const sendClientInvitation of [undefined,null,'true']){
  const {response,sent,saved}=await scenario({sendClientInvitation});
  assert.equal(response.status,400);assert.equal(sent.length,0);assert.equal(saved.length,0);
 }
});
test('opt-in sends only meeting details and retains notes inside CRM',async()=>{
 const {response,sent,saved}=await scenario({sendClientInvitation:true});
 assert.equal(response.status,200);assert.equal(sent.length,1);
 assert.match(sent[0].url,/sendUpdates=all/);
 assert.deepEqual(sent[0].body.attendees,[{email:'cliente@example.com'}]);
 assert.equal(sent[0].body.summary,'Reunión comercial');assert.equal(sent[0].body.location,'Oficina');
 assert.ok(sent[0].body.start.dateTime);assert.ok(sent[0].body.end.dateTime);
 assert.doesNotMatch(JSON.stringify(sent[0]),/NOTA PRIVADA|presupuesto|estrategia|Telefono/);
 assert.match(saved[0].body,/NOTA PRIVADA/);
});
test('opt-out omits customer, independently of inviting Pablo',async()=>{
 for(const includePablo of [false,true]){
  const {response,sent,saved}=await scenario({sendClientInvitation:false,includePablo});
  assert.equal(response.status,200);
  assert.equal(sent[0].body.attendees.some(a=>a.email==='cliente@example.com'),false);
  assert.equal(sent[0].body.attendees.length,includePablo?1:0);
  assert.match(sent[0].url,includePablo?/sendUpdates=all/:/sendUpdates=none/);
  assert.doesNotMatch(JSON.stringify(sent[0]),/NOTA PRIVADA/);assert.match(saved[0].body,/no enviar/);
 }
});
test('no email rejects opt-in, but permits booking without sending',async()=>{
 assert.equal((await scenario({sendClientInvitation:true},{noEmail:true})).response.status,400);
 assert.equal((await scenario({sendClientInvitation:false},{noEmail:true})).response.status,200);
});
test('ownership rejection never sends an invitation',async()=>{
 const {response,sent}=await scenario({sendClientInvitation:true},{denied:true});
 assert.equal(response.status,404);assert.equal(sent.length,0);
});
test('all agent meeting forms expose the choice and send it to the server',()=>{
 for(const name of ['crm-meeting-scheduler','crm-calendar-actions','crm-calendar-view','crm-board']){
  const source=fs.readFileSync(`components/admin/${name}.tsx`,'utf8');
  assert.match(source,/<MeetingClientInvitation/);assert.match(source,/sendClientInvitation/);assert.match(source,/Notas internas/);
 }
});
