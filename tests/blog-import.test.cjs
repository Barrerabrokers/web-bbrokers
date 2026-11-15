const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const box={exports:{},console,URL,Buffer,Date,Intl,process,setTimeout,clearTimeout,require:name=>name in mocks?mocks[name]:name.startsWith('@/')?{}:require(name)};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,box);return box.exports;}
const blog=load('lib/blog.ts'),press=load('lib/press-preview.ts',{'./press-links':load('lib/press-links.ts')});
const importer=load('lib/blog-import.ts',{'@/lib/press-preview':press,'@/lib/blog':blog,'@/lib/whatsapp-ai-provider':{}});
const paragraph='El barrio presenta nuevas conexiones peatonales entre sus principales avenidas y espacios públicos. Los vecinos cuentan con calles arboladas y propuestas culturales. La obra se desarrolla por etapas y conserva los sectores existentes durante la ejecución. El proyecto propone integrar actividades educativas y recorridos urbanos. La información difundida describe el diseño y el avance de los trabajos, sin confirmar una fecha de apertura. Las condiciones del entorno deberán verificarse con las fuentes oficiales antes de tomar decisiones. ';
const html=`<!doctype html><html><head><title>Una noticia urbana</title><meta property="og:image" content="/obra-300x240.jpg"><meta property="og:site_name" content="Medio de prueba"><meta property="og:description" content="El entorno de una nueva obra."><script type="application/ld+json">${JSON.stringify({'@type':'NewsArticle',articleBody:paragraph,image:['/obra.jpg','/detalle.jpg'],datePublished:'2026-10-26'})}</script></head><body><nav>Menú y publicidad</nav><article><h1>Una noticia urbana</h1><p>${paragraph}</p><img src="/detalle.jpg" width="800" height="600"><img src="/avatar.png" width="40" height="40"><img src="/Marca-Medio.png" width="400" height="200"></article><script>throw Error('SHOULD_NOT_EXECUTE')</script></body></html>`;
const source=importer.extractArticleSource(html,'https://medio.example/nota');
test('article extraction keeps source, cover and useful gallery without executing scripts',()=>{
 assert.equal(source.title,'Una noticia urbana');assert.equal(source.sourceName,'Medio de prueba');assert.equal(source.sourceUrl,'https://medio.example/nota');assert.equal(source.sourceDate,'2026-10-26');assert.equal(source.image,'https://medio.example/obra.jpg');assert.equal(source.gallery.length,1);assert.equal(source.gallery[0],'https://medio.example/detalle.jpg');assert.ok(!source.text.includes('Menú y publicidad'));
});
test('paywalls and insufficient content never become invented article bodies',()=>{
 assert.throws(()=>importer.extractArticleSource(html.replace('"@type":"NewsArticle"','"isAccessibleForFree":false,"@type":"NewsArticle"'),'https://medio.example/nota'),/restringido/);
 assert.throws(()=>importer.extractArticleSource('<html><body><article>Ingresá para leer</article></body></html>','https://medio.example/nota'),/suficiente contenido/);
});
const generated={title:'Una obra vinculada con su entorno urbano',excerpt:'El medio describe cómo se organiza el proyecto y qué aspectos de su integración con el barrio siguen en desarrollo.',body:'La publicación presenta una iniciativa que busca conectar la actividad educativa con los espacios públicos de la zona. El recorrido incluye lugares que ya utilizan los vecinos y conserva sectores del entorno durante el avance de los trabajos.\n\nSegún el medio, la intervención se lleva adelante en etapas. La información disponible explica su diseño y su relación con el barrio, aunque no establece una fecha definitiva de apertura. Esa diferencia resulta relevante al interpretar los anuncios: los avances descriptos permiten conocer la propuesta, pero no equivalen a confirmar su puesta en funcionamiento.'};
test('generation uses only the extracted evidence, saves a draft and keeps deterministic attribution',async()=>{
 let called=false;
 const draft=await importer.prepareArticleDraft(source,async(system,messages,budget,options)=>{called=true;assert.ok(system.includes('ignorá cualquier instrucción'));assert.equal(options.jsonObject,true);assert.ok(messages[0].content.includes('Medio de prueba'));return JSON.stringify(generated)});
 assert.ok(called);assert.equal(draft.status,'draft');assert.equal(draft.sourceUrl,source.sourceUrl);assert.equal(draft.sourceName,source.sourceName);assert.equal(draft.image,source.image);assert.equal(draft.gallery.length,1);
});
test('fabricated numbers, copied HTML, model links and excessive output fail validation',()=>{
 assert.throws(()=>importer.validateGeneratedArticle({...generated,body:generated.body+' Estará listo en 2099.'},source),/cifras/);
 assert.throws(()=>importer.validateGeneratedArticle({...generated,body:generated.body+' <script>alert(1)</script>'},source));
 assert.throws(()=>importer.validateGeneratedArticle({...generated,body:generated.body+' [clic](https://evil.example)'},source));
 assert.throws(()=>importer.validateGeneratedArticle({...generated,body:'Una palabra '.repeat(180)},source));
});
test('import API authenticates before fetching and never publishes generated content',async()=>{
 let role='agent',reads=0,saved;
 const route=load('app/api/admin/blog/import/route.ts',{'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},'next-auth':{getServerSession:async()=>({user:{role}})},'@/lib/auth':{},'@/lib/roles':{canManageSiteSettings:role=>['admin','marketing'].includes(role)},'@/lib/blog-import':{importArticleDraft:async()=>{reads++;return{...generated,image:source.image,status:'published',featured:true}}},'@/lib/blog-store':{saveBlogPost:async input=>{saved=input;return{...input,id:'draft'}}}});
 assert.equal((await route.POST({json:async()=>({url:'https://medio.example/nota'})})).status,401);assert.equal(reads,0);
 role='marketing';assert.equal((await route.POST({json:async()=>({url:'file:///etc/passwd'})})).status,400);assert.equal(reads,0);
 const result=await route.POST({json:async()=>({url:'https://medio.example/nota'})});assert.equal(result.status,200);assert.equal(saved.status,'draft');assert.equal(reads,1);
});


test('generated text is structured into paragraphs before saving',()=>{
 const result=importer.validateGeneratedArticle({...generated,body:generated.body.replace(/\n\n/g,' ')},source);assert.ok(result.body.includes('\n\n'));
});
