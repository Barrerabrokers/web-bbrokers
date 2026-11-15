const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const box={exports:{},process,require:n=>n in mocks?mocks[n]:n.startsWith('@/')?{}:require(n)};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,box);return box.exports;}
test('public navigation has only the requested destinations and contact has its own URL',()=>{
 const nav=load('lib/public-navigation-links.ts').PUBLIC_NAVIGATION;
 assert.deepEqual(Array.from(nav,n=>n.label),['Todos los Desarrollos','Prensa','Inversión','Mapa','Contacto']);
 assert.deepEqual(Array.from(nav,n=>n.href),['/desarrollos','/blog','/inversiones-real-estate-buenos-aires','/ciudad-de-buenos-aires','/contacto']);
});
test('only rental category pages are marked noindex; the main property page stays indexable',async()=>{
 const page=load('app/propiedades/page.tsx',{'@/lib/i18n/metadata':{localizePublicMetadata:async m=>m},'@/lib/seo':load('lib/seo.ts')});
 for(const categoria of ['rentals','alquileres','alquiler']){const meta=await page.generateMetadata({searchParams:Promise.resolve({categoria})});assert.equal(meta.robots.index,false);assert.equal(meta.robots.follow,true);}
 for(const categoria of [undefined,'pozo','inversiones']){const meta=await page.generateMetadata({searchParams:Promise.resolve({categoria})});assert.notEqual(meta.robots?.index,false);}
});
test('brochure remains accessible but is excluded from search indexing',()=>{
 const page=load('app/desarrollos/[slug]/brochure/page.tsx');assert.equal(page.metadata.robots.index,false);assert.equal(page.metadata.robots.follow,true);
});
test('development links use a public-only query and release their database connection',async()=>{
 let query='',released=false;const sql=async strings=>{query=strings.join('');return [{name:' Alpha Place Belgrano ',slug:'alpha-place-belgrano'}]};const module=load('lib/public-navigation.ts',{'react':{cache:fn=>fn},'@/lib/database-pool':{getSharedDatabase:()=>sql,releaseSharedDatabase:async s=>{assert.equal(s,sql);released=true}}});
 const links=await module.getPublicDevelopmentLinks();assert.match(query,/WHERE visibility='public'/);assert.equal(links[0].name,'Alpha Place Belgrano');assert.equal(links[0].href,'/desarrollos/alpha-place-belgrano');assert.equal(released,true);
});
