const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps={}) {
 const m={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,
 {module:m,exports:m.exports,require:n=>deps[n]||require(n),process,console});
 return m.exports;
}
const content=load('lib/crm-clients-content.ts');
function route(file,role,overrides={}) {
 return load(file,{'next/server':{NextResponse:{json:(body,options)=>Response.json(body,options)}},
 'next-auth':{getServerSession:async()=>role?{user:{role,id:'00000000-0000-4000-8000-000000000001'}}:null},
 '@/lib/auth':{authOptions:{}},'@/lib/crm-clients':new Proxy({},{get:()=>()=>{throw Error('Unexpected database access');}}),
 '@/lib/crm-clients-content':content,'@/lib/crm-client-campaigns':{resolveCampaignText:value=>value,resolveCampaignBlocks:value=>value},
 '@/lib/crm-email-sender':{sendPrivateClientEmail:()=>{throw Error('Unexpected email');}},...overrides});
}
const request=(body,query="")=>({json:async()=>body,nextUrl:new URL('https://example.com/api/crm/clients'+query)});
test('all private client endpoints reject anonymous, agent and marketing before accessing data',async()=>{
 for(const role of [null,'agent','marketing'])for(const file of ['route.ts','template/route.ts','send/route.ts','send-list/route.ts']){
  const handlers=route('app/api/crm/clients/'+file,role);
  for(const method of ['GET','POST'])if(handlers[method])assert.equal((await handlers[method](request({}))).status,403);
 }
});
test('list campaigns require the exact list confirmation and deduplicate each campaign recipient',()=>{
 const source=fs.readFileSync('app/api/crm/clients/send-list/route.ts','utf8');
 assert.match(source,/confirmList!==parsed\.data\.listName/);
 assert.match(source,/ON CONFLICT\(campaign_id,client_id\) WHERE campaign_id IS NOT NULL DO NOTHING/);
 assert.match(source,/console\.error\("CRM client campaign error:"/);
 assert.match(source,/c\.subscribed AND c\.email<>''/);
 assert.match(source,/replyTo:String\(recipient\.reply_to_email/);
 assert.match(source,/openTrackingUrl:/);
 assert.match(source,/clickTrackingBaseUrl:/);
 const resumeSource=fs.readFileSync('lib/crm-client-campaigns.ts','utf8');
 assert.match(resumeSource,/h\.status='uncertain'/);
 assert.match(resumeSource,/SET status='sending'[\s\S]*AND status='uncertain'/);
 assert.match(resumeSource,/setTimeout\(resolveDelay,650\)/);
 assert.match(resumeSource,/pg_try_advisory_lock/);
 assert.match(resumeSource,/retry_count[\s\S]*last_attempt_at/);
 const cronSource=fs.readFileSync('app/api/cron/crm-client-campaigns/route.ts','utf8');
 assert.match(cronSource,/export async function GET/);
 assert.match(cronSource,/processPendingClientCampaigns\(12\)/);
 assert.match(fs.readFileSync('vercel.json','utf8'),/\/api\/cron\/crm-client-campaigns/);
});
test('private templates and listing load for administrators',async()=>{
  const deps={'@/lib/crm-clients':{getPrivateClients:async()=>({clients:[],hasMore:false}),getClientDraft:async()=>content.CLIENT_NEWSLETTER}};
  for(const file of ['route.ts','template/route.ts'])assert.equal((await route('app/api/crm/clients/'+file,'admin',deps).GET(request())).status,200);
});
test('administrators can inspect lead statuses and email templates without exposing them to other roles',async()=>{
  const deps={'@/lib/crm-clients':{
    getClientLeadStatuses:async()=>[{status:'Vendido',eligible:3,alreadyClients:1}],
    getClientEmailTemplates:async()=>[{id:'template-1',channel:'email',name:'Novedades'}]
  }};
  const api=route('app/api/crm/clients/route.ts','admin',deps);
  const statuses=await api.GET(request({},'?statuses=1'));
  assert.deepEqual(await statuses.json(),{statuses:[{status:'Vendido',eligible:3,alreadyClients:1}]});
  const templates=await api.GET(request({},'?templates=1'));
  assert.deepEqual(await templates.json(),{templates:[{id:'template-1',channel:'email',name:'Novedades'}]});
  assert.equal((await route('app/api/crm/clients/route.ts','agent').GET(request({},'?statuses=1'))).status,403);
});
test('bulk client import requires confirmation and does not update lead fields',async()=>{
  let calls=0;
  const deps={'@/lib/crm-clients':{importClientsByLeadStatus:async(status,actor)=>{calls++;assert.equal(status,'Vendido');assert.match(actor,/^[0-9a-f-]{36}$/);return {eligible:4,added:3,skipped:1};}}};
  const api=route('app/api/crm/clients/route.ts','admin',deps);
  assert.equal((await api.POST(request({action:'import-status',status:'Vendido',confirmed:false}))).status,400);
  assert.equal(calls,0);
  const response=await api.POST(request({action:'import-status',status:'Vendido',confirmed:true}));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,eligible:4,added:3,skipped:1});assert.equal(calls,1);
  const clientsSource=fs.readFileSync('lib/crm-clients.ts','utf8');
  assert.match(clientsSource,/Pendiente de completar la compra\.',true,l\.status,l\.id/);
  assert.doesNotMatch(clientsSource,/UPDATE\s+crm_leads/i);
  assert.match(clientsSource,/filter\(template=>template\.channel==="email"\)/);
});
test('template placeholders require replacement and personalize names literally',()=>{
 assert.equal(content.newsletterHasPlaceholders('',content.CLIENT_NEWSLETTER.body),true);
 assert.equal(content.personalizeClientNewsletter('Hola {{nombre}}','Ana $&'),'Hola Ana $&');
 assert.equal(content.newsletterHasPlaceholders('Novedades','Hola Ana, nueva información.'),false);
});
const valid={clientId:'00000000-0000-4000-8000-000000000002',requestId:'00000000-0000-4000-8000-000000000003',subject:'Novedades',body:'Hola Ana, novedades del mercado.',confirmed:true};
test('sending requires explicit confirmation and finished content',async()=>{
 const api=route('app/api/crm/clients/send/route.ts','admin');
 for(const body of [{...valid,confirmed:false},{...valid,body:'[Completar proyecto]'},{...valid,subject:'Hola\nBcc: test@example.com'}])assert.equal((await api.POST(request(body))).status,400);
});
test('send guard checks subscription, deduplicates and keeps delivery history private',async()=>{
 for(const scenario of ['unsubscribed','duplicate','sent','uncertain']){
  let sent=0;const queries=[];
  const sql=async(strings,...values)=>{
   const text=strings.join('?');queries.push(text);
   if(text.includes('SELECT email'))return [{email:'test@example.com',subscribed:scenario!=='unsubscribed'}];
   if(text.includes('INSERT INTO'))return scenario==='duplicate'?[]:[{id:valid.requestId}];
   return [];
  };
  sql.begin=async fn=>fn(sql);sql.end=async()=>{};
  const api=route('app/api/crm/clients/send/route.ts','admin',{
   '@/lib/crm-clients':{clientDb:()=>sql,ensureClients:async()=>{}},
   '@/lib/crm-email-sender':{sendPrivateClientEmail:async input=>{sent++;assert.equal(input.email,'test@example.com');assert.match(input.body,/respondé BAJA/);if(scenario==='uncertain')throw Error('timeout');}}
  });
  const response=await api.POST(request(valid));
  assert.equal(response.status,scenario==='sent'?200:scenario==='uncertain'?502:409);
  assert.equal(sent,scenario==='sent'||scenario==='uncertain'?1:0);
  assert.equal(queries.some(q=>q.includes('crm_activities')),false);
  if(scenario==='sent')assert.ok(queries.some(q=>q.includes("status='sent'")));
 }
});
test('navigation and page guard restrict the client list to administrators',()=>{
 const sidebar=fs.readFileSync('components/admin/admin-sidebar.tsx','utf8');
 const nav=fs.readFileSync('components/admin/crm-nav.tsx','utf8');
 assert.match(sidebar,/href: "\/admin\/crm\/clientes"[^\n]*label: "Correos de Marketing"[^\n]*strictAdminOnly: true/);
 assert.match(nav,/href: "\/admin\/crm\/clientes"[^\n]*label: "Correos de Marketing"[^\n]*administratorOnly: true/);
 const page=fs.readFileSync('app/admin/crm/clientes/page.tsx','utf8');
 assert.match(page,/session\?\.user.role!=="admin"/);
 assert.ok(page.indexOf('redirect("/admin/crm")')<page.indexOf('return <>'));
});
test('marketing emails use lead-status lists and only saved email templates',()=>{
 const ui=fs.readFileSync('components/admin/crm-clients.tsx','utf8');
 assert.match(ui,/Correos de Marketing/);
 assert.match(ui,/Crear una lista por Estado del Lead/);
 assert.match(ui,/Plantilla guardada/);
 assert.match(ui,/Desde aquí no se puede redactar ni modificar/);
 assert.doesNotMatch(ui,/saveDraft|crm\/clients\/template|Contenido<textarea/);
 assert.match(ui,/Informe de campañas/);
 assert.match(ui,/Tasa de apertura confirmada/);
 assert.match(ui,/Tasa de clic/);
 assert.match(ui,/Precargas automáticas/);
 const reportSource=fs.readFileSync('lib/crm-clients.ts','utf8');
 assert.match(reportSource,/AND h\.status='sent' ORDER BY score/);
 assert.match(reportSource,/AND NOT e\.privacy_protected/);
 assert.match(reportSource,/WHEN e\.event_type='click' THEN 0/);
});
test('campaign report is restricted to administrators',async()=>{
 const deps={'@/lib/crm-clients':{getClientCampaigns:async()=>[],getClientCampaignReport:async()=>null}};
 assert.equal((await route('app/api/crm/clients/report/route.ts','agent',deps).GET(request({}))).status,403);
 assert.equal((await route('app/api/crm/clients/report/route.ts','admin',deps).GET(request({}))).status,200);
});
test('campaign report avoids concurrent schema DDL and redundant selector reloads',()=>{
 const clients=fs.readFileSync('lib/crm-clients.ts','utf8');
 assert.match(clients,/to_regclass\('public\.crm_client_mail_history'\)/);
 assert.match(clients,/pg_advisory_lock/);
 assert.match(clients,/history_columns\)===15/);
 const workspace=fs.readFileSync('components/admin/crm-clients.tsx','utf8');
 assert.match(workspace,/setSelectedCampaign\(current=>nextCampaigns\.some/);
 assert.match(workspace,/\},\[refresh\]\);/);
});
