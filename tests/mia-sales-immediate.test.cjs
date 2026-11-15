const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');require('../work/mia-web-test/load-ts.cjs');
function load(file,mocks){const m=new Module(file);m.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id.startsWith('.')?'../lib/'+id.slice(2)+'.ts':id);m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);return m.exports;}
const leadId='00000000-0000-0000-0000-000000000001',agentId='00000000-0000-0000-0000-000000000002';
test('assignment commits scoped openings before scheduling the Vercel after worker',async()=>{
 const callbacks=[],order=[];let eligible=true;const sql=async strings=>strings.join('').includes('to_regclass')?[{ready:true}]:eligible?[{lead_id:leadId}]:[];sql.end=async()=>{};
 const api=load('lib/mia-sales-dispatch.ts',{'next/server':{after:fn=>{order.push('after');callbacks.push(fn)}},'./mia-sales-store':{miaSalesDb:()=>sql},'./mia-sales-assignment':{enrollAssignedMiaContacts:async(db,ids)=>{assert.deepEqual(ids,[leadId]);order.push('durable');return 1}},'./mia-sales-worker':{processMiaSalesPilot:async options=>{assert.deepEqual(options.leadIds,[leadId]);order.push('worker');return {sent:2}}}});
 assert.equal((await api.dispatchMiaAssignment([leadId,leadId])).queuedContacts,1);assert.deepEqual(order,['durable','after']);await callbacks[0]();assert.deepEqual(order,['durable','after','worker']);
 eligible=false;await api.dispatchMiaAssignment([leadId]);assert.equal(callbacks.length,1,'Paused, reassigned, sent or stopped jobs do not start another worker');
});
test('automatic assignment attempts email and approved WhatsApp in the same run outside office hours, once only',async()=>{
 const policy=require('../lib/mia-sales-policy.ts'),phoneId=require('../lib/whatsapp-inbox-scope.ts').firstContactWhatsAppPhoneId();
 const config={enabled:true,automatic_assignments:true,agent_id:agentId,run_id:'run',email:'info@barrerabrokers.com'};
 const e={lead_id:leadId,run_id:'run',state:'working',started_at:new Date('2026-01-01'),assigned_agent_id:agentId,status:'Nuevo',notes:'',analysis:null};
 const raw={id:leadId,assigned_agent_id:agentId,status:'Nuevo',email:'test@example.test',first_name:'Prueba',phone:'5491112345678'};
 const conversation={id:'conversation',lead_id:leadId,phone:raw.phone,channel:'whatsapp',business_phone_number_id:phoneId,ai_enabled:true,status:'open',assigned_agent_id:agentId};
 const jobs=['email','whatsapp'].map((channel,i)=>({id:'job'+i,channel,kind:'opening',state:'pending',lead_id:leadId,run_id:'run',subject:'Consulta',content:'Hola, soy MIA, la asistente virtual de Barrera Brokers. ¿Seguís buscando?'}));
 const sent=[],saved=[];let analyses=0,incoming=[],sundayWindow=false;
 const sql=async(strings,...args)=>{const q=strings.join('');
  if(q.includes('to_regclass'))return [{ready:true}];
  if(q.includes('SELECT c.*,a.email')||q.includes('SELECT * FROM crm_mia_sales_control'))return config.enabled?[config]:[];
  if(q.includes('SELECT e.*,l.assigned_agent_id')){assert(args.some(v=>Array.isArray(v)&&v.includes(leadId)));return [e]}
  if(q.includes('SELECT * FROM crm_mia_sales_enrollments'))return [e];
  if(q.includes('SELECT content,due_at,state'))return jobs.filter(j=>args.includes(j.id));
  if(q.includes(') incoming WHERE'))return incoming;
  if(q.includes('SELECT j.*')){assert(q.includes("j.kind IN('opening','followup','reply')"));return jobs.filter(j=>j.state==='pending')}
  if(q.includes('SELECT * FROM crm_leads'))return [raw];
  if(q.includes('SELECT EXISTS'))return [{blocked:false}];
  if(q.includes("SET state='sending'")){const j=jobs.find(j=>args.includes(j.id));if(j.state!=='pending')return [];j.state='sending';return [{id:j.id}]}
  if(q.includes("SET state='sent'")){jobs.find(j=>args.includes(j.id)).state='sent';return []}
  if(q.includes("INTERVAL '24 hours'"))throw Error('Automatic WhatsApp was delayed after email');
  if(q.includes('SELECT value FROM crm_whatsapp_agent_settings'))return [{value:JSON.stringify({name:'test_template'})}];
  if(q.includes('SELECT agent_id FROM crm_email_accounts'))return [{agent_id:agentId}];
  if(q.includes('SELECT c.id,')||q.includes('FROM crm_whatsapp_conversations WHERE phone=')||q.includes('SELECT * FROM crm_whatsapp_conversations'))return [conversation];
  if(q.includes('SELECT provider_id'))return [{provider_id:'mock-wa'}];
  return [];
 };sql.begin=async fn=>fn(sql);sql.end=async()=>{};sql.json=v=>v;
 const previousFetch=global.fetch;global.fetch=async(url,options)=>{assert(String(url).startsWith('https://graph.facebook.com/'));if(String(url).includes('message_templates'))return {ok:true,json:async()=>({data:[{name:'test_template',status:'APPROVED',language:'es_AR',components:[{type:'BODY',text:'Hola {{1}}, soy MIA de Barrera Brokers. Retomo tu consulta sobre {{2}}.'}]}]})};assert.equal(JSON.parse(options.body).type,'template');sent.push('whatsapp');return {ok:true,json:async()=>({messages:[{id:'mock-wa'}]})}};
 try{
 const worker=load('lib/mia-sales-worker.ts',{'./mia-sales-followup':{reconcileMiaSalesFollowup:async()=>({scheduled:0}),miaSundayDispatchOpen:()=>sundayWindow},
 './mia-sales-store':{miaSalesDb:()=>sql,notifyMiaSales:async()=>{}},'./mia-sales-policy':{...policy,miaSalesHours:()=>false},'./mia-sales-assignment':{enrollAssignedMiaContacts:async(db,ids)=>assert.deepEqual(ids,[leadId]),prepareMiaSalesContact:async(db,enrollment,control,options)=>{analyses++;const message='Hola, soy MIA, la asistente virtual de Barrera Brokers. ¿Seguimos con tu búsqueda?';if(options?.followup)for(const j of jobs)if(j.kind==='followup'&&j.state==='pending')j.content=message;return e.analysis={action:'contact',topic:'tu búsqueda',message,analyzedAt:new Date().toISOString()}}},
 './database-worker-lease':{acquireWorkerLease:async()=> 'lease',releaseWorkerLease:async()=>{}},'./crm-sales-context':{getSalesEvidence:async()=>[{events:[]}]},'./db':{getCrmLeadById:async()=>raw},'./crm-email-sender':{sendCrmEmail:async()=>{sent.push('email');return {sent:true,activity:{id:'mock-email'}}}},
 './whatsapp-credentials':{getWhatsAppChannelCredentials:async()=>({accessToken:'mock',wabaId:'123'})},'./whatsapp-inbox':{ensureWhatsAppInboxSchema:async()=>{},saveWhatsAppMessage:async value=>saved.push(value),sendWhatsAppText:async()=>{throw Error('No free text without a customer window')}},'./whatsapp-turn-lock':{claimWhatsAppHumanSend:async()=> 'token',releaseWhatsAppSend:async()=>{}},'./mia-access':{getMiaAccess:async()=>({}),miaAccessAllows:()=>true},'./whatsapp-delivery':{reconcileWhatsAppDelivery:async()=>{}}
 });
 const result=await worker.processMiaSalesPilot({leadIds:[leadId]});assert.equal(result.sent,2);assert.deepEqual(sent,['email','whatsapp']);assert.equal(analyses,1);assert.equal(saved[0].senderType,'ai');assert.equal(saved[0].senderAgentId,agentId);assert(jobs.every(j=>j.state==='sent'));
 await worker.processMiaSalesPilot({leadIds:[leadId]});assert.equal(sent.length,2,'Same assignment cannot send again');config.enabled=false;await worker.processMiaSalesPilot({leadIds:[leadId]});assert.equal(sent.length,2,'Global pause prevents delivery');
 config.enabled=true;for(const channel of ['email','whatsapp'])jobs.push({...jobs.find(j=>j.channel===channel),id:'followup-'+channel,kind:'followup',state:'pending',content:'',due_at:new Date(Date.now()-1000),followup_anchor_at:new Date(Date.now()-5*86400000)});
 await worker.processMiaSalesPilot({leadIds:[leadId]});assert.equal(sent.length,2,'Weekly follow-ups cannot send outside Sunday evening');sundayWindow=true;
 await worker.processMiaSalesPilot({leadIds:[leadId]});assert.equal(sent.length,4,'Both weekly follow-up channels are sent');assert.equal(analyses,2,'One fresh history analysis per pair');
 for(const channel of ['email','whatsapp'])jobs.push({...jobs.find(j=>j.channel===channel),id:'late-'+channel,kind:'followup',state:'pending',due_at:new Date(Date.now()-1000),followup_anchor_at:new Date(Date.now()-5*86400000)});incoming=[{id:'new-customer-reply',at:new Date()}];await worker.processMiaSalesPilot({leadIds:[leadId]});assert.equal(sent.length,4,'A reply arriving before provider call cancels both channels');
 }finally{global.fetch=previousFetch}
});
