const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}) { const box={exports:{},Intl,Date,process,console,URL,crypto:require('node:crypto'),require:id=>id in mocks?mocks[id]:require(id)};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,box);return box.exports; }
const policy=load('lib/crm-agenda-policy.ts');
test('all seven weekdays accept 09:30 starts for half-hour and hour appointments',()=>{
 for(let day=1;day<=7;day++)for(const duration of [30,60])assert.equal(policy.agendaScheduleError(`2030-07-0${day}T09:30:00-03:00`,duration),null);
 assert.ok(policy.agendaTimes(30).includes('09:30'));assert.ok(policy.agendaTimes(60).includes('09:30'));
});
test('business hours use Argentina timezone and reject off-grid and overflowing appointments',()=>{
 for(const [time,duration] of [['08:00',30],['20:30',30],['20:00',60]])assert.equal(policy.agendaScheduleError(`2030-07-01T${time}:00-03:00`,duration),null);
 for(const [time,duration] of [['07:30',30],['21:00',30],['20:30',60],['09:15',30],['09:30',45]])assert.ok(policy.agendaScheduleError(`2030-07-01T${time}:00-03:00`,duration));
 assert.ok(policy.agendaScheduleError('2030-07-01T12:30:01Z',30));assert.ok(policy.agendaScheduleError('invalid',30));
 assert.equal(policy.agendaHour('2030-07-01T12:30:00Z'),9.5);
 assert.equal(policy.agendaTimes(30).at(-1),'20:30');assert.equal(policy.agendaTimes(60).at(-1),'20:00');
});
test('meeting API rejects invalid slots before Google calls for agents and administrators',async()=>{
 for(const role of ['agent','admin']){
 let external=0;
 const route=load('app/api/crm/calendar/events/route.ts',{'@/lib/crm-agenda-policy':policy,'next/server':{NextResponse:{json:(body,options)=>Response.json(body,options)}},'next-auth':{getServerSession:async()=>({user:{id:'actor',role}})},'@/lib/auth':{},'@/lib/roles':{canManageListings:()=>true},'@/lib/db':{getCrmEmailAccountWithSecret:async()=>{external++}},'@/lib/google-calendar-connection':{},'@/lib/google-oauth':{},'@/lib/crm-calendar-availability':{},'@/app/api/crm/activities/route':{},'@/lib/crm-meeting-lifecycle':{}});
 for(const time of ['07:30','09:15','20:30']){const response=await route.POST(new Request('https://crm.test',{method:'POST',body:JSON.stringify({leadId:'00000000-0000-4000-8000-000000000001',type:'reunion',title:'Prueba',duration:60,scheduledAt:new Date(`2030-07-01T${time}:00-03:00`).toISOString(),sendClientInvitation:false})}));assert.equal(response.status,400)}
 assert.equal(external,0);
 }
});
module.exports={load,policy};
test('task creation keeps the selected duration for all CRM roles and refuses invalid hours',async()=>{
 for(const role of ['agent','admin']){
 const saved=[];
 const route=load('app/api/crm/activities/route.ts',{'@/lib/crm-agenda-policy':policy,'next/server':{NextResponse:{json:(body,options)=>Response.json(body,options)}},'next-auth':{getServerSession:async()=>({user:{id:'actor',role}})},'@/lib/auth':{},'@/lib/roles':{canManageListings:()=>true,canViewAllCrmContacts:()=>role==='admin'},'@/lib/db':{getCrmLeadById:async()=>({id:'lead'}),createCrmActivity:async data=>{saved.push(data);return {activity:{id:'activity',...data}}}},'@/lib/crm-activity-edit':{},'@/lib/crm-task-schedule':{processCrmTaskSchedules:async()=>({pending:false})},'@/lib/ai-sales/schedule':{}});
 for(const duration of [30,60]){
 const response=await route.POST(new Request('https://crm.test',{method:'POST',body:JSON.stringify({leadId:'00000000-0000-4000-8000-000000000001',type:'tarea',title:'Tarea de prueba',duration,scheduledAt:'2030-07-07T12:30:00.000Z'})}));assert.equal(response.status,200);assert.equal(saved.at(-1).duration,duration);
 }
 const response=await route.POST(new Request('https://crm.test',{method:'POST',body:JSON.stringify({leadId:'00000000-0000-4000-8000-000000000001',type:'tarea',title:'Tarea inválida',duration:60,scheduledAt:'2030-07-07T23:30:00.000Z'})}));assert.equal(response.status,400);assert.equal(saved.length,2);
 }
});
