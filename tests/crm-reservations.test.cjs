const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={},globals={}) {
 const box={exports:{},console,Date,Map,AbortSignal,process,...globals,require:name=>name in mocks?mocks[name]:require(name)};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,box);
 return box.exports;
}
const helpers=load('lib/crm-purchases.ts');
const timing=load('lib/argentina-time.ts');
const reservation={id:'00000000-0000-0000-0000-000000000010',type:'RESERVA',development:'Junín',units:['401','402'],date:'2026-10-14',signingAt:'2026-10-16T18:30:00.000Z',price:100000,advance:30000,balance:70000};
function calendarModule(sql, fetch) {
 return load('lib/crm-reservation-calendar.ts', {
  '@/lib/database-pool':{getSharedDatabase:()=>sql,releaseSharedDatabase:async()=>{}},
  '@/lib/db':{getCrmEmailAccountWithSecret:async()=>({provider:'google-oauth'})},
  '@/lib/google-oauth':{getAccessTokenForGoogleAccount:async()=> 'test-token'},
  '@/lib/google-calendar-connection':{hasGoogleCalendarAccess:()=>true},
  '@/lib/runtime-schema':{shouldRunRuntimeSchemaMigrations:()=>false},
  '@/lib/database-worker-lease':{acquireWorkerLease:async()=> 'lease',releaseWorkerLease:async()=>{}},
 },{fetch});
}
test('reservation conversion keeps amounts, signing time, original reserve date and audit',()=>{
 const data=helpers.applyPurchaseChange({operations:[reservation]}, {action:'edit',index:0,purchase:{...reservation,type:'VENTA',date:'2026-10-16'}},'admin','now');
 assert.equal(data.operations.length,1);
 assert.equal(data.operations[0].reservationDate,'2026-10-14');
 assert.equal(data.operations[0].id,reservation.id);
 assert.equal(data.operations[0].signingAt,reservation.signingAt);
 assert.equal(data.operations[0].balance,70000);
 assert.equal(data.audit[0].before.type,'RESERVA');
 assert.equal(timing.argentinaLocalDateTimeToIso('2026-10-16','15:30'),reservation.signingAt);
 assert.equal(helpers.purchaseSchema.safeParse({...reservation,signingAt:'not-a-date'}).success,false);
});
test('API rejects missing reservation date and earlier signing before any write',async()=>{
 let writes=0;
 const route=load('app/api/crm/purchases/route.ts',{
  'next/server':{after:()=>{},NextResponse:{json:(body,{status})=>({body,status})}},
  'next-auth':{getServerSession:async()=>({user:{role:'admin',id:'admin'}})},
  '@/lib/auth':{authOptions:{}},'@/lib/crm-purchases':helpers,
  '@/lib/crm-reservation-calendar':{},
  '@/lib/crm-purchases-store':{saveCrmPurchaseChange:async()=>{writes++;return {status:200,version:'saved'}}},
 });
 for(const purchase of [{...reservation,date:null},{...reservation,signingAt:'2026-10-14T01:00:00.000Z'}]) {
  const response=await route.POST({json:async()=>({leadId:'00000000-0000-0000-0000-000000000011',version:null,change:{action:'add',purchase}})});
  assert.equal(response.status,400);
 }
 assert.equal(writes,0);
});
test('saving reserves and the signature is atomic; stale forms never update agendas',async()=>{
 let stored=null, activityWrites=0;
 const tx=async(strings,...values)=>{
  const query=strings.join('?');
  if(query.includes('SELECT meta_properties'))return[{meta_properties:{[helpers.PURCHASES_KEY]:stored}}];
  if(query.includes('UPDATE crm_leads'))stored=values[0][helpers.PURCHASES_KEY];
  return[];
 };
 tx.json=value=>value;
 const sql={begin:async fn=>fn(tx)};
 const store=load('lib/crm-purchases-store.ts',{
  '@/lib/database-pool':{getSharedDatabase:()=>sql,releaseSharedDatabase:async()=>{}},
  '@/lib/crm-purchases':helpers,
  '@/lib/crm-reservation-calendar':{ensureReservationCalendars:async()=>{},updateReservationActivities:async()=>activityWrites++},
 });
 const added=await store.saveCrmPurchaseChange('lead',null,{action:'add',purchase:reservation},'admin');
 assert.equal(added.status,200);assert.equal(activityWrites,1);
 const id=JSON.parse(added.version).operations[0].id;
 assert.notEqual(id,reservation.id); // identity is owned by the server
 const stale=await store.saveCrmPurchaseChange('lead',null,{action:'add',purchase:reservation},'admin');
 assert.equal(stale.status,409);assert.equal(activityWrites,1);
 const changed=await store.saveCrmPurchaseChange('lead',added.version,{action:'edit',index:0,purchase:{...reservation,id:'00000000-0000-0000-0000-000000000099'}},'admin');
 assert.equal(JSON.parse(changed.version).operations[0].id,id);
});
test('joint units produce one signature; editing upserts it; removing last unit removes it',async()=>{
 const queries=[];
 const tx=async(strings,...values)=>{queries.push({query:strings.join('?'),values});return[]};
 const module=calendarModule(tx,()=>{throw Error('external call inside transaction')});
 await module.updateReservationActivities(tx,'lead',{operations:[reservation]},'admin');
 assert.equal(queries.filter(q=>q.query.includes('INSERT INTO crm_activities')).length,1);
 assert.ok(queries[1].query.includes('ON CONFLICT'));
 assert.ok(queries[1].values.some(v=>String(v).includes('401, 402')));
 queries.length=0;
 await module.updateReservationActivities(tx,'lead',{operations:[]},'admin');
 assert.equal(queries.length,1);assert.ok(queries[0].query.includes('DELETE'));assert.equal(queries[0].values[1].length,0);
});
test('calendar retries recover timeouts without duplicates; rescheduling uses the same Google ID',async()=>{
 const rows=[{id:'job',recipient_id:'agent',event_id:'bbr123',active:true,title:'Firma',body:'Interno',scheduled_at:reservation.signingAt,lead_id:'lead',contact_name:'Cliente',synced_version:null}];
 let calls=[],fail=true;
 const sql=async(strings,...values)=>{
  const query=strings.join('?');
  if(query.includes('SELECT q.*'))return rows;
  if(query.includes('SET synced_version='))rows[0].synced_version=values[0];
  return[];
 };
 const module=calendarModule(sql,async(url,options)=>{
  calls.push({url,options});if(fail)throw Error('timeout');return{ok:true,status:200};
 });
 assert.equal((await module.processReservationCalendars('lead')).failed,1);
 fail=false;assert.equal((await module.processReservationCalendars('lead')).synced,1);
 assert.ok(calls.every(c=>c.url.endsWith('/bbr123')));
 assert.equal(JSON.parse(calls[1].options.body).start.dateTime,reservation.signingAt);
 assert.equal(JSON.parse(calls[1].options.body).attendees.length,0);
 assert.equal((await module.processReservationCalendars('lead')).synced,0);
 rows[0].scheduled_at='2026-10-17T18:30:00.000Z';
 assert.equal((await module.processReservationCalendars('lead')).synced,1);
 assert.ok(calls.at(-1).url.endsWith('/bbr123'));
 rows[0].active=false;
 await module.processReservationCalendars('lead');assert.equal(calls.at(-1).options.method,'DELETE');
});
test('every active administrator and current owner gets a separate retryable calendar job',async()=>{
 const queries=[];
 const sql=async(strings,...values)=>{const query=strings.join('?');queries.push(query);return[]};
 await calendarModule(sql,()=>{throw Error('no rows')}).processReservationCalendars();
 assert.match(queries[0],/agent.active AND \(agent.role='admin' OR agent.id=l.assigned_agent_id\)/);
 assert.match(queries[0],/ON CONFLICT\(activity_id,recipient_id\) DO NOTHING/);
 assert.match(queries[1],/agent.role='admin' OR agent.id=l.assigned_agent_id/);
});
test('reservation form has dates, amounts, grouped units and read-only conversion remains hidden',()=>{
 const React=require('react'), render=require('react-dom/server').renderToStaticMarkup;
 let state=0;
 const react={...React,useState:initial=>{
  state++;
  const value=state===2?'new':state===3?{...reservation,date:reservation.date,price:'100000',advance:'30000',balance:'70000',signingDate:'2026-10-16',signingTime:'15:30'}:typeof initial==='function'?initial():initial;
  return[value,()=>{}];
 }};
 const component=load('components/admin/crm-purchase-history.tsx',{'react':react,'next/navigation':{useRouter:()=>({refresh(){}})},'@/lib/crm-purchases':helpers,'@/lib/argentina-time':timing}).CrmPurchaseHistory;
 const html=render(React.createElement(component,{leadId:'lead',value:null,canEdit:true}));
 for(const text of ['Nueva reserva','Fecha de la reserva','Fecha de firma','Hora de firma (Argentina)','Guardar reserva','Valor total (USD)','Anticipo (USD)','Saldo (USD)'])assert.ok(html.includes(text),text);
 assert.ok(html.includes('value="401"'));assert.ok(html.includes('value="402"'));
});
test('a calendar without a Google connection does not block another recipient',async()=>{
 const rows=['agent','admin'].map(recipient_id=>({id:recipient_id,recipient_id,event_id:`bbr${recipient_id}`,active:true,title:'Firma',body:'',scheduled_at:reservation.signingAt,lead_id:'lead',contact_name:'Cliente'}));
 const sql=async(strings,...values)=>{
  const query=strings.join('?');
  if(query.includes('SELECT q.*'))return rows;
  if(query.includes('SET synced_version='))rows.find(row=>row.id===values[1]).synced_version=values[0];
  return[];
 };
 const module=load('lib/crm-reservation-calendar.ts',{
  '@/lib/database-pool':{getSharedDatabase:()=>sql,releaseSharedDatabase:async()=>{}},
  '@/lib/db':{getCrmEmailAccountWithSecret:async id=>id==='agent'?null:{provider:'google-oauth'}},
  '@/lib/google-oauth':{getAccessTokenForGoogleAccount:async()=> 'test-token'},
  '@/lib/google-calendar-connection':{hasGoogleCalendarAccess:()=>true},
  '@/lib/runtime-schema':{shouldRunRuntimeSchemaMigrations:()=>false},
  '@/lib/database-worker-lease':{acquireWorkerLease:async()=> 'lease',releaseWorkerLease:async()=>{}},
 },{fetch:async()=>({status:200,ok:true})});
 const result=await module.processReservationCalendars('lead');
 assert.equal(result.synced,1);assert.equal(result.failed,1);assert.equal(result.pending,true);
 assert.ok(rows[1].synced_version);assert.equal(rows[0].synced_version,undefined);
});
test('a missing Google event is created with a persisted ID and an existing ID is updated after conflict',async()=>{
 const queries=[],calls=[],statuses=[404,409,200];
 const sql=async(strings,...values)=>{
  const query=strings.join('?');queries.push(query);
  if(query.includes('SELECT q.*'))return[{id:'job',recipient_id:'admin',event_id:'bbr123',active:true,title:'Firma',body:'',scheduled_at:reservation.signingAt,lead_id:'lead',contact_name:'Cliente'}];
  return[];
 };
 await calendarModule(sql,async(url,options)=>{calls.push({url,options});const status=statuses.shift();return{status,ok:status===200}}).processReservationCalendars('lead');
 assert.deepEqual(calls.map(c=>c.options.method),['PATCH','POST','PATCH']);
 assert.equal(JSON.parse(calls[1].options.body).id,'bbr123');
 assert.ok(queries.some(q=>q.includes('SET synced_version=')));
});
test('calendar view shows the stored signature even without Google connected',()=>{
 const React=require('react'),render=require('react-dom/server').renderToStaticMarkup;
 const component=load('components/admin/crm-calendar-view.tsx',{
  'next/navigation':{useRouter:()=>({refresh(){}})},
  'next/link':{default:({href,children,...props})=>React.createElement('a',{href,...props},children)},
  '@/components/admin/meeting-client-invitation':{},'@/lib/argentina-time':timing,
 }).CrmCalendarView;
 const lead={id:'lead',firstName:'Cliente',lastName:'Reserva',email:'client@example.test'};
 const html=render(React.createElement(component,{isGoogleConnected:false,email:null,leads:[lead],activities:[{id:'signature',leadId:'lead',lead,title:'Firma · Junín · UF 401',externalSource:'reservation_signature',type:'nota',body:'',scheduledAt:'2099-10-16T18:30:00.000Z',createdAt:'2026-10-14T10:00:00.000Z'}]}));
 assert.ok(html.includes('Próximas firmas'));assert.ok(html.includes('15:30'));assert.ok(html.includes('Cliente Reserva'));assert.ok(html.includes('/admin/crm/lead#purchase-information'));
});
