const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function setup() {
  const scripts = [];
  const window = { location: { href: 'https://barrerabrokers.com/' } };
  const box = { exports: {}, process: { env: {} }, window, URL, crypto: require('node:crypto'), document: { createElement: () => ({}), head: { appendChild: s => scripts.push(s) } } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/meta-pixel.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, box);
  return { api: box.exports, window, scripts, events: () => window.fbq?.queue.filter(x => x[0] === 'trackSingle') || [] };
}
test('public events initialize once and navigation counts revisits without strict-mode duplicates', () => {
  const {api,window,scripts,events} = setup();
  api.trackMetaPage(); assert.equal(scripts.length,0);
  api.setMetaTrackingEnabled(true);
  api.trackMetaPage(); api.trackMetaPage();
  assert.equal(events().length,1); assert.equal(scripts.length,1);
  window.location.href += 'propiedades/unit-1';
  const data = {content_ids:['unit-1'],content_type:'home_listing'};
  api.trackMetaPageEvent('ViewContent',data); api.trackMetaPageEvent('ViewContent',data); api.trackMetaPage();
  assert.deepEqual(Array.from(events(),x=>x[2]),['PageView','PageView','ViewContent']);
  window.location.href='https://barrerabrokers.com/'; api.trackMetaPage();
  assert.equal(events().length,4); assert.equal(scripts.length,1);
  assert.equal(new Set(events().map(x=>x[4].eventID)).size,4);
});
test('CRM, login, upload, shared links and arbitrary query data are never tracked', () => {
  const {api,window,scripts} = setup(); api.setMetaTrackingEnabled(true);
  for (const path of ['/admin/crm/a','/en/admin/crm','/login','/upload/a','/api/contact','/desarrollos/alpha?share=secret','/contacto?email=private@example.com','/meetings/a']) {
    window.location.href='https://barrerabrokers.com'+path;
    assert.equal(api.isPublicTrackingUrl(new URL(window.location.href)),false,path);
    api.trackMetaEvent('Lead'); api.trackMetaPage();
  }
  assert.equal(scripts.length,0);
  assert.equal(api.isPublicTrackingUrl(new URL('https://barrerabrokers.com/en/propiedades?categoria=pozo&utm_source=meta')),true);
});
test('session exclusion disables queued events and resumes after signout', () => {
  const {api,events,window} = setup(); api.setMetaTrackingEnabled(true); api.trackMetaPage();
  api.setMetaTrackingEnabled(false); api.trackMetaEvent('Lead'); assert.equal(events().length,1);
  assert.ok(window.fbq.queue.some(x=>x[0]==='consent'&&x[1]==='revoke'));
  api.setMetaTrackingEnabled(true); api.trackMetaPage(); assert.equal(events().length,2);
});
test('WhatsApp classification excludes lookalike and other destinations', () => {
  const {api}=setup();
  for(const url of ['https://wa.me/5411','https://api.whatsapp.com/send?phone=5411','https://web.whatsapp.com/send']) assert.equal(api.isWhatsAppLink(url),true);
  for(const url of ['https://wa.me.evil.com/','https://example.com/?url=wa.me','mailto:a@b.com','javascript:alert(1)']) assert.equal(api.isWhatsAppLink(url),false);
});
test('tracking failures cannot break successful inquiry UI', () => {
 const {api,window}=setup(); api.setMetaTrackingEnabled(true); api.trackMetaPage();
 window.fbq=()=>{throw Error('blocked')}; assert.doesNotThrow(()=>api.trackMetaEvent('Lead'));
});
test('all three forms emit Lead only after successful persistence, never on HTTP or network failures', async () => {
 for(const [file,component,props] of [
  ['components/home/contact-section.tsx','ContactSection',{}],
  ['components/development/development-inquiry-panel.tsx','DevelopmentInquiryPanel',{developmentName:'Demo',location:'Buenos Aires'}],
  ['components/property-inquiry-form.tsx','PropertyInquiryForm',{propertyId:'unit-1',propertyTitle:'Demo',propertyLocation:'Buenos Aires'}]
 ]) {
  for(const outcome of ['success','http-error','network-error']) {
   const events=[],states=[];
   const jsx=(type,props)=>({type,props});
   const mocks={react:{useState:initial=>[initial,v=>states.push(v)]},'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/use-site-settings':{useSiteSettings:()=>({whatsapp:'5411',addressCity:'Buenos Aires'})},'@/lib/meta-pixel':{trackMetaEvent:(...args)=>events.push(args)},'lucide-react':{},'@/components/social-links':{}};
   const box={exports:{},require:n=>mocks[n],fetch:async()=>{if(outcome==='network-error')throw Error('offline');return {ok:outcome==='success'}},setTimeout:()=>0};
   vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,box);
   const tree=box.exports[component](props);
   function find(node){if(!node||typeof node!=='object')return;if(node.type==='form')return node;for(const child of [node.props?.children].flat()){const found=find(child);if(found)return found;}}
   await find(tree).props.onSubmit({preventDefault(){}});
   assert.equal(events.length,outcome==='success'?1:0,`${component}: ${outcome}`);
   if(events.length){assert.equal(events[0][0],'Lead');assert.deepEqual(Object.keys(events[0][1]),['content_name']);}
  }
 }
});
