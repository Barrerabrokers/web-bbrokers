const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const box={exports:{},console,URL,Buffer,setTimeout,clearTimeout,require:name=>name in mocks?mocks[name]:name.startsWith('@/')?{}:require(name)};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,box);return box.exports;}
const helper=load('lib/press-links.ts');
const layout=load('lib/stage-carousel-layout.ts');
const carousel=load('components/home/press-carousel.tsx',{'@/lib/stage-carousel-layout':layout});
test('existing newline links retain URLs and editable fallback titles',()=>{
 const entries=helper.readPressEntries('https://medio.com/una-nota\nwww.otro.com/entrevista');assert.equal(entries.length,2);assert.equal(entries[0].title,'una nota');assert.equal(entries[1].url,'https://www.otro.com/entrevista');
 const saved=helper.serializePressLinks('https://medio.com/una-nota');assert.equal(helper.parsePressLinks(saved)[0].url,'https://medio.com/una-nota');
});
test('manual titles roundtrip including accents, punctuation and pipe characters',()=>{
 const value=helper.serializePressLinks(JSON.stringify([{title:'  Inversión: Buenos Aires | una oportunidad  ',url:'https://medio.com/slug-que-no-es-el-titulo'}]));const [entry]=helper.parsePressLinks(value);
 assert.equal(entry.label,'Inversión: Buenos Aires | una oportunidad');assert.equal(entry.host,'medio.com');
});
test('unsafe and incomplete links cannot be saved; empty press section stays hidden and saved entries are never omitted',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,hello','https://user:password@medio.com/nota',''])assert.throws(()=>helper.serializePressLinks(JSON.stringify([{title:'Nota',url}])));
 assert.throws(()=>helper.serializePressLinks(JSON.stringify([{title:'',url:'https://medio.com/nota'}])));
 assert.equal(helper.parsePressLinks('').length,0);assert.equal(helper.parsePressLinks('https://medio.com/nota\nhttps://medio.com/nota').length,2);
 assert.equal(helper.parsePressLinks('javascript:alert(1)').length,1);
 assert.equal(helper.parsePressLinks('javascript:alert(1)')[0].url,'');
});
test('homepage press keeps media titles and leads visitors into the blog',async()=>{
 const React=require('react'),render=require('react-dom/server').renderToStaticMarkup;
 const component=load('components/home/press-section.tsx',{'@/lib/blog-store':{listBlogPosts:async()=>[]},'@/components/home/press-carousel':carousel,'@/lib/press-links':helper,'@/lib/db':{getFullSiteSettings:async()=>({pressLinks:JSON.stringify([{title:'Título escrito por el administrador',url:'https://medio.com/nota'}])})},'next/link':({children,...props})=>React.createElement('a',props,children)}).PressSection;
 const html=render(await component());assert.ok(html.includes('Título escrito por el administrador'));assert.ok(html.includes('href="/blog#en-los-medios"'));assert.ok(!html.includes('target="_blank"'));assert.ok(html.includes('href="/blog"'));
});
test('settings validates press before writing and preserves existing permission rules',async()=>{
 let role='admin',writes=0,saved;
 const route=load('app/api/settings/route.ts',{'@/lib/press-links':helper,'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},'next-auth':{getServerSession:async()=>({user:{role}})},'@/lib/auth':{},'@/lib/roles':{canManageSiteSettings:role=>['admin','marketing'].includes(role)},'next/cache':{revalidateTag(){},revalidatePath(){}},'@/lib/db':{updateFullSiteSettings:async data=>{writes++;saved=data;return{settings:data}}}});
 const value=JSON.stringify([{title:'Nota manual',url:'https://medio.com/nota'}]);assert.equal((await route.PUT({json:async()=>({pressLinks:value})})).status,200);assert.equal(JSON.parse(saved.pressLinks)[0].title,'Nota manual');
 assert.equal((await route.PUT({json:async()=>({pressLinks:JSON.stringify([{title:'Nota',url:'javascript:alert(1)'}])})})).status,400);assert.equal(writes,1);
 role='agent';assert.equal((await route.PUT({json:async()=>({pressLinks:value})})).status,401);assert.equal(writes,1);
});

test('all notes render, including repeated links and legacy notes needing a corrected URL',async()=>{
 const React=require('react'),render=require('react-dom/server').renderToStaticMarkup;
 const entries=Array.from({length:101},(_,index)=>({title:`Nota ${index+1}`,url:'https://medio.com/nota'}));
 assert.equal(JSON.parse(helper.serializePressLinks(JSON.stringify(entries))).length,101);
 entries.push({title:'Título conservado con enlace pendiente',url:'javascript:alert(1)'});
 const component=load('components/home/press-section.tsx',{'@/lib/blog-store':{listBlogPosts:async()=>[]},'@/components/home/press-carousel':carousel,'@/lib/press-links':helper,'@/lib/db':{getFullSiteSettings:async()=>({pressLinks:JSON.stringify(entries)})},'next/link':({children,...props})=>React.createElement('a',props,children)}).PressSection;
 const html=render(await component());assert.equal([...html.matchAll(/<h3\b/g)].length,102);assert.equal([...html.matchAll(/target="_blank"/g)].length,0);assert.ok(html.includes('Título conservado con enlace pendiente'));assert.ok(html.includes('href="/blog#en-los-medios"'));assert.ok(!html.includes('href="javascript:'));
});


test('press images roundtrip and unsafe image protocols are rejected',()=>{
 const saved=helper.serializePressLinks(JSON.stringify([{title:'Nota',url:'https://medio.com/nota',image:'https://cdn.medio.com/foto.jpg'}]));
 assert.equal(helper.parsePressLinks(saved)[0].image,'https://cdn.medio.com/foto.jpg');
 for(const image of ['javascript:alert(1)','data:image/svg+xml,test','http://medio.com/image.jpg'])assert.throws(()=>helper.serializePressLinks(JSON.stringify([{title:'Nota',url:'https://medio.com/nota',image}])));
 assert.equal(helper.parsePressLinks(JSON.stringify([{title:'Nota',url:'https://medio.com',image:'javascript:alert(1)'}]))[0].image,'');
});

test('metadata handles reordered attributes, relative images and escaped text',()=>{
 const preview=load('lib/press-preview.ts',{'./press-links':helper});
 const result=preview.extractPressPreview(`<meta content='Una inversión &amp; futuro' property='og:title'><meta content='/foto.jpg?a=1&amp;b=2' property='og:image'>`,'https://medio.com/noticia');
 assert.equal(result.title,'Una inversión & futuro');assert.equal(result.image,'https://medio.com/foto.jpg?a=1&b=2');
 assert.equal(preview.extractPressPreview('<title>Nota alternativa</title>','https://medio.com').title,'Nota alternativa');
 for(const address of ['127.0.0.1','10.0.0.1','192.168.1.1','169.254.169.254','172.16.0.1','100.64.0.1','::1','224.0.0.1'])assert.equal(preview.isPublicPressAddress(address),false,address);
 assert.equal(preview.isPublicPressAddress('8.8.8.8'),true);
});

test('preview requires settings permission and does not fetch for unauthorized users',async()=>{
 let role='agent',calls=0;
 const route=load('app/api/press/preview/route.ts',{'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},'next-auth':{getServerSession:async()=>({user:{role}})},'@/lib/auth':{},'@/lib/roles':{canManageSiteSettings:role=>['admin','marketing'].includes(role)},'@/lib/press-preview':{fetchPressPreview:async()=>{calls++;return{title:'Nota',image:'https://medio.com/foto.jpg'}}}});
 assert.equal((await route.POST({json:async()=>({url:'https://medio.com/nota'})})).status,401);assert.equal(calls,0);
 role='marketing';assert.equal((await route.POST({json:async()=>({url:'https://medio.com/nota'})})).status,200);assert.equal(calls,1);
 assert.equal((await route.POST({json:async()=>({url:4})})).status,400);assert.equal(calls,1);
});

test('preview pins public DNS for Node lookup modes and rejects private redirects',async()=>{
 const {EventEmitter}=require('node:events');let requested=0,redirect=false;
 const preview=load('lib/press-preview.ts',{'./press-links':helper,'node:dns/promises':{lookup:async(host)=>[{address:host==='private.example'?'127.0.0.1':'8.8.8.8',family:4}]},'node:https':{request:(url,options,onResponse)=>{
  requested++;options.lookup(url.hostname,{all:true},(err,addresses)=>assert.equal(addresses[0].address,'8.8.8.8'));
  options.lookup(url.hostname,{},(err,address,family)=>{assert.equal(address,'8.8.8.8');assert.equal(family,4)});
  const req=new EventEmitter();req.destroy=error=>req.emit('error',error);req.end=()=>setImmediate(()=>{
   const response=new EventEmitter();response.resume=()=>{};response.statusCode=redirect?302:200;response.headers=redirect?{location:'https://private.example/secret'}:{'content-type':'text/html'};
   onResponse(response);if(!redirect){response.emit('data',Buffer.from('<meta property="og:title" content="Public article">'));response.emit('end')}req.emit('close');
  });return req;
 }}});
 // Supply the Node globals normally present in the server runtime.
 assert.equal((await preview.fetchPressPreview('https://news.example/article')).title,'Public article');
 redirect=true;await assert.rejects(()=>preview.fetchPressPreview('https://news.example/redirect'),/público/);assert.equal(requested,2);
});
