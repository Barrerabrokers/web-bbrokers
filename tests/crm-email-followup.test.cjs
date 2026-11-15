const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file, overrides={}, globals={}) {
  const module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,URL,URLSearchParams,Headers,console,...globals,require:n=>overrides[n]||require(n)});
  return module.exports;
}
test('login keeps contact, activity, exact email and search while rejecting unsafe destinations',()=>{
  const {loginDestination}=load('lib/login-destination.ts');
  const target='/admin/crm/contact?activity=correo&email=email-1&q=Belgrano#correo';
  assert.equal(loginDestination(target),target);
  for(const value of [null,'https://evil.test','//evil.test','/\\evil.test','/admin/../../login','/login','/admin/%0aevil','/admin/%5cevil','javascript:alert(1)'])assert.equal(loginDestination(value),'/admin');
});
test('successful sign-in returns to the email instead of the dashboard',async()=>{
  const destination='/admin/crm/contact?activity=correo&email=email-1';
  const navigations=[],signIns=[];
  const {default:Login}=load('app/login/page.tsx',{
    react:{useState:value=>[value,()=>{}]},
    'next-auth/react':{signIn:async(provider,options)=>{signIns.push(options);return {ok:true}}},
    'next/navigation':{useRouter:()=>({replace:path=>navigations.push(path),refresh(){}})},
    '@/lib/use-site-settings':{useSiteSettings:()=>({logoUrl:'/logo.svg',companyName:'Barrera Brokers'})},
    '@/lib/login-destination':load('lib/login-destination.ts')
  },{window:{location:{search:'?from='+encodeURIComponent(destination)}}});
  function findForm(node){if(!node)return;if(Array.isArray(node)){for(const child of node){const found=findForm(child);if(found)return found;}return;}if(node.type==='form')return node;return findForm(node.props?.children);}
  await findForm(Login()).props.onSubmit({preventDefault(){}});
  assert.deepEqual(navigations,[destination]);
  assert.equal(signIns[0].callbackUrl,destination);
});
test('middleware replaces spoofed return headers and unauthenticated layout preserves the entire query',async()=>{
  const target='/admin/crm/contact?activity=correo&email=email-1';
  const {middleware}=load('middleware.ts',{'next/server':{NextResponse:{next:x=>x}}});
  const result=middleware({headers:new Headers({'x-admin-destination':'https://evil.test'}),nextUrl:new URL('https://barrerabrokers.com'+target)});
  assert.equal(result.request.headers.get('x-admin-destination'),target);
  const {default:Layout}=load('app/admin/layout.tsx',{
    'next-auth':{getServerSession:async()=>null},'@/lib/auth':{},'@/components/admin/admin-shell':{},
    'next/headers':{headers:async()=>result.request.headers},'@/lib/login-destination':load('lib/login-destination.ts'),
    'next/navigation':{redirect:href=>{throw new Error(href)}}
  });
  await assert.rejects(Layout({children:null}),error=>error.message==='/login?from='+encodeURIComponent(target));
});
test('email selection prefers the tracking ID and never substitutes a similar or ambiguous message',()=>{
  const {findTrackedEmailActivity}=load('lib/crm-email-followup.ts');
  const tracking={id:'t1',subject:'Visita',createdAt:'2026-10-03T12:00:00Z'};
  const other={id:'a2',type:'correo',title:'Correo enviado: Visita',externalId:'email-tracking:t2',body:'Wrong message',createdAt:tracking.createdAt};
  const exact={...other,id:'a1',externalId:'email-tracking:t1',title:'Envío de workflow',body:'Correct message'};
  assert.equal(findTrackedEmailActivity(tracking,[other,exact]),exact);
  assert.equal(findTrackedEmailActivity(tracking,[other]),undefined);
  const legacy={...other,externalId:undefined};
  assert.equal(findTrackedEmailActivity(tracking,[legacy]),legacy);
  assert.equal(findTrackedEmailActivity(tracking,[legacy,{...legacy,id:'a3'}]),undefined);
});
test('existing notification entries resolve their exact email from the persisted event key',()=>{
  const {emailOpenDestination}=load('lib/crm-email-followup.ts');
  const id='00000000-0000-0000-0000-000000000060';
  assert.equal(emailOpenDestination('contact',`email-open:${id}`,'/admin/crm/contact?activity=correo'),`/admin/crm/contact?activity=correo&email=${id}`);
  assert.equal(emailOpenDestination('contact','email-reply:other','/admin/crm/contact'),'/admin/crm/contact');
});
test('cold and existing app windows retain the exact notification email destination',async()=>{
  const target='https://barrerabrokers.com/admin/crm/contact?activity=correo&email=t1';
  for(const warm of [false,true]){
    const events={},opened=[],navigated=[];
    const client={url:'https://barrerabrokers.com/admin/crm',navigate:async href=>navigated.push(href),focus:async()=>{}};
    const self={location:{origin:'https://barrerabrokers.com'},addEventListener:(key,fn)=>events[key]=fn,clients:{matchAll:async()=>warm?[client]:[],openWindow:async href=>opened.push(href)}};
    vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{self,URL});
    let work;events.notificationclick({notification:{data:{href:target},close(){}},waitUntil:p=>work=p});await work;
    assert.deepEqual(warm?navigated:opened,[target]);
  }
});
