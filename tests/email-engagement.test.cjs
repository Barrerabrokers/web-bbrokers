const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const loaded={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/email-engagement.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:loaded,exports:loaded.exports,require,URL});
const {parseEmailUserAgent,safeTrackedUrl}=loaded.exports;
test('email devices and privacy proxies are classified without storing raw user agents',()=>{
 assert.equal(parseEmailUserAgent('Mozilla/5.0 (iPhone) Mobile').deviceType,'iPhone');
 assert.equal(parseEmailUserAgent('Mozilla/5.0 (iPad)').deviceType,'Tablet');
 assert.equal(parseEmailUserAgent('GoogleImageProxy').privacyProtected,true);
 assert.equal(parseEmailUserAgent('GoogleImageProxy').deviceType,'Desconocido');
 assert.equal(parseEmailUserAgent('Microsoft Outlook').mailClient,'Outlook');
});
test('click redirects only accept web links',()=>{
 assert.equal(safeTrackedUrl('javascript:alert(1)'),null);
 assert.equal(safeTrackedUrl('mailto:test@example.com'),null);
 assert.equal(safeTrackedUrl('https://barrerabrokers.com/proyecto'),'https://barrerabrokers.com/proyecto');
});
