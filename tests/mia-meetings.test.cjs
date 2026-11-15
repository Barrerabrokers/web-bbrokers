const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
function load(file,mocks={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:id=>mocks[id]||(id.startsWith('@/')?load(id.slice(2)+'.ts',mocks):require(id)),Date,process,console:{warn(){}},AbortSignal});return module.exports;}
const policy=load('lib/mia-meeting-policy.ts');
const config={enabled:true,organizerId:'72114681-27f9-4bb0-980a-1a880a8b6d80',location:'Oficina de prueba',weekdays:[1,2,3,4,5],startTime:'09:00',endTime:'18:00',duration:30,leadMinutes:60};
const none={intent:'start',mode:null,choice:null,date:null,weekdays:[],period:'any',time:null,name:null,email:null};
test('two actually free choices prefer different days and local morning/afternoon',()=>{
 const now=new Date('2026-10-20T18:00:00Z'),slots=policy.proposeMeetingSlots(config,[],none,now);
 assert.equal(slots.length,2);assert.notEqual(slots[0].start.slice(0,10),slots[1].start.slice(0,10));
 assert.equal(new Date(slots[0].start).getUTCHours(),19);assert.equal(new Date(slots[1].start).getUTCHours(),13);
 assert(slots.every(s=>policy.allowedMeetingSlot(s,config,now)));
 const busy=[{start:'2026-10-21T00:00:00-03:00',end:'2026-10-22T00:00:00-03:00'}];assert(policy.proposeMeetingSlots(config,busy,none,now).every(s=>!s.start.startsWith('2026-10-21')));
});
test('requested weekday, date, period, duration and lead time are enforced, including all-day events and invalid dates',()=>{
 const now=new Date('2026-10-20T18:00:00Z');const offers=policy.proposeMeetingSlots(config,[],{...none,weekdays:[5],period:'morning'},now);
 assert(offers.every(s=>new Date(s.start).getUTCDay()===5&&new Date(s.start).getUTCHours()<15));
 assert.equal(policy.proposeMeetingSlots(config,[],{...none,date:'2026-02-31'},now).length,0);
 assert.equal(policy.proposeMeetingSlots(config,[],{...none,date:'2026-10-24'},now).length,0);
 assert.equal(policy.allowedMeetingSlot({start:'2026-10-20T18:30:00Z',end:'2026-10-20T19:00:00Z'},config,now),false);
 assert.equal(policy.meetingConfigSchema.safeParse({...config,location:'A definir'}).success,false);
 for(const text of ['Sí','Confirmo','Dale','De acuerdo','Sí, está bien','Sí, perfecto, agendala','Confirmo la reunión'])assert(policy.explicitlyConfirmsMeeting(text));
 for(const text of ['Sí, pero el viernes','No','Tal vez','¿y el jueves?'])assert(!policy.explicitlyConfirmsMeeting(text));
});
function harness(options={}){
 const calls={insert:0,activities:0,calendarReads:0,claims:0,released:0,model:0},events=new Map();let saved=null,version=0,busy=[];let turn=none;
 const sql=async(strings,...args)=>{const q=strings.join('?');
  if(q.includes("key='mia-meeting-scheduling-v1'"))return [{value:JSON.stringify({...config,enabled:options.enabled!==false})}];
  if(q.includes('SELECT id FROM agents'))return [{id:config.organizerId}];
  if(q.includes('SELECT version,state FROM'))return saved?[{version,state:JSON.parse(JSON.stringify(saved))}]:[];
  if(q.includes('SELECT c.lead_id'))return [{lead_id:'lead',contact_name:'Cliente',phone:'5491100000000',first_name:'Carolina',last_name:'Prueba',email:options.noEmail?'':'carolina@example.com'}];
  if(q.includes('INSERT INTO crm_mia_meeting_sessions(conversation_id,state)')){if(saved)return [];saved=JSON.parse(JSON.stringify(args[1]));version=0;return [{version}];}
  if(q.includes('UPDATE crm_mia_meeting_sessions SET state=')){if(args[2]!==version)return [];saved=JSON.parse(JSON.stringify(args[0]));return [{version:++version}];}
  return [];
 };
 sql.json=x=>x;
 const mocks={'@/lib/database-pool':{getSharedDatabase:()=>sql,releaseSharedDatabase:async()=>{}},'@/lib/db':{getCrmEmailAccountWithSecret:async()=>({provider:'google-oauth',googleScopes:'https://www.googleapis.com/auth/calendar'}),createCrmActivity:async()=>{calls.activities++;return {activity:{id:'11111111-1111-4111-8111-111111111111'}};}},'@/lib/google-oauth':{getAccessTokenForGoogleAccount:async()=>{if(options.calendarFailure)throw Error('Disconnected');return 'test-token';}},'@/lib/crm-calendar-availability':{getCrmCalendarBusy:async()=>{calls.calendarReads++;return busy;}},'@/lib/meeting-scheduler':{getBookedRanges:async()=>[]},'@/lib/crm-meeting-lifecycle':{registerScheduledMeeting:async()=>{}},'@/lib/database-worker-lease':{acquireWorkerLease:async()=>options.contended?null:'lease',releaseWorkerLease:async()=>{}},'@/lib/whatsapp-turn-lock':{claimWhatsAppAiSend:async()=>{calls.claims++;return options.intervened?null:'lock';},releaseWhatsAppSend:async()=>{calls.released++;}},'@/lib/whatsapp-ai-provider':{generateGroqCustomerReply:async()=>{calls.model++;return JSON.stringify(turn);}}};
 const fetch=async(url,init={})=>{
  if(init.method==='POST'){calls.insert++;const e=JSON.parse(init.body);assert.equal(e.description,'Reunión coordinada con Barrera Brokers.');assert(!e.description.includes('Notas privadas'));events.set(e.id,{...e,hangoutLink:'https://meet.google.com/abc-defg-hij'});if(options.timeoutAfterCreate&&calls.insert===1)throw Error('Timeout');return {ok:true,status:200,json:async()=>events.get(e.id)};}
  const id=url.split('/').at(-1);return {ok:events.has(id),status:events.has(id)?200:404,json:async()=>events.get(id)};
 };
 const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/mia-meetings.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:id=>mocks[id]||(id.startsWith('@/')?load(id.slice(2)+'.ts',mocks):require(id)),Date,process,console:{warn(){}},AbortSignal,fetch});
 return {dialogue:(messages,opts={})=>module.exports.replyMiaMeeting('chat',messages,opts),calls,events,get state(){return saved},turn:t=>turn={...none,...t},busy:r=>busy=r,reply:(text,opts={})=>module.exports.replyMiaMeeting('chat',[{direction:'inbound',content:text,whatsappMessageId:'incoming'}],opts)};
}
async function choose(h){h.turn({intent:'start'});const offers=await h.reply('Quiero agendar una reunión');assert.equal(offers.state.offers.length,2);h.turn({intent:'select',choice:1,mode:'google_meet'});return h.reply('La primera, virtual');}
test('actual scheduling offers two choices, asks for confirmation, creates one event with Meet and records the CRM meeting',async()=>{
 const h=harness();const choice=await choose(h);assert.match(choice.reply,/Confirmás/);assert.equal(h.calls.insert,0);
 const booked=await h.reply('Sí');assert.match(booked.reply,/Reunión confirmada/);assert.match(booked.reply,/https:\/\/meet.google.com/);assert.equal(h.calls.insert,1);assert.equal(h.calls.activities,1);assert.equal(h.calls.released,1);
 await h.reply('Confirmo');assert.equal(h.calls.insert,1);
});
test('a CRM human intervention, calendar failure or newly busy slot cannot create a meeting',async()=>{
 const human=harness({intervened:true});await choose(human);assert.doesNotMatch((await human.reply('Sí')).reply,/Reunión confirmada/);assert.equal(human.calls.insert,0);
 const down=harness({calendarFailure:true});const r=await down.reply('Quiero agendar una reunión');assert.match(r.reply,/No pude verificar/);assert.equal(down.calls.insert,0);
 const taken=harness();await choose(taken);taken.busy([taken.state.selected]);const r2=await taken.reply('Sí');assert.match(r2.reply,/acaba de ocuparse/);assert.equal(taken.calls.insert,0);assert.equal(r2.state.phase,'offered');
});
test('an uncertain Calendar timeout recovers the same event ID instead of creating another invitation',async()=>{
 const h=harness({timeoutAfterCreate:true});await choose(h);const uncertain=await h.reply('Sí');assert.match(uncertain.reply,/pendiente de verificación/);assert.equal(h.state.phase,'creating');assert.equal(h.calls.insert,1);
 const recovered=await h.reply('Sí');assert.match(recovered.reply,/Reunión confirmada/);assert.equal(h.calls.insert,1);assert.equal(h.calls.activities,1);
});
test('missing client email is requested, and changing the date is never treated as final confirmation',async()=>{
 const h=harness({noEmail:true});const r=await choose(h);assert.match(r.reply,/qué correo/);assert.equal(h.state.phase,'details');assert.equal(h.calls.insert,0);
 const changed=harness();await choose(changed);changed.turn({intent:'availability',weekdays:[5],period:'morning'});const r2=await changed.reply('Sí, pero el viernes por la mañana');assert.equal(changed.calls.insert,0);assert.equal(r2.state.phase,'offered');
});
test('preview never creates or recovers a real event, including crafted creating state',async()=>{
 const h=harness();h.turn({intent:'start'});let r=await h.reply('Agendar reunión',{preview:true});h.turn({intent:'select',choice:1,mode:'in_person',name:'Cliente',email:'cliente@example.com'});r=await h.reply('La primera presencial',{preview:true,state:r.state});r=await h.reply('Confirmo',{preview:true,state:r.state});assert.match(r.reply,/Simulación/);assert.equal(h.calls.insert,0);assert.equal(h.calls.activities,0);assert.equal(h.calls.claims,0);
 const forged=await h.reply('Agendar reunión',{preview:true,state:{...r.state,phase:'creating'}});assert.match(forged.reply,/no puede recuperar/);assert.equal(h.calls.insert,0);
});
test('a cancellation during an uncertain attempt never retries creating a calendar event',async()=>{
 const h=harness({timeoutAfterCreate:true});await choose(h);await h.reply('Sí');assert.equal(h.calls.insert,1);
 const r=await h.reply('No quiero agendar, cancelalo');assert.equal(r.state.phase,'review');assert.equal(h.calls.insert,1);
 await h.reply('Sí');assert.equal(h.calls.insert,1);
});

test('accepting the assistant meeting invitation starts real availability, while brochure replies do not',async()=>{
 const h=harness();const r=await h.dialogue([{direction:'outbound',content:'¿Querés coordinar una reunión con Pablo?'},{direction:'inbound',content:'Sí',whatsappMessageId:'in'}]);assert.equal(r.state.offers.length,2);assert.equal(h.calls.insert,0);
 const brochure=harness();assert.equal(await brochure.dialogue([{direction:'outbound',content:'¿Te paso el brochure del showroom?'},{direction:'inbound',content:'Sí'}]),null);
});
