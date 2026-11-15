const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const snapshot=require('../lib/cac-history.json');
function load(file,mocks={}){const box={exports:{},Intl,Date,Response,require:n=>n in mocks?mocks[n]:require(n)};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,box);return box.exports;}
const cac=load('lib/cac.ts',{'@/lib/cac-history.json':snapshot});
test('history covers every month from January 2011 to September 2026 exactly once',()=>{
 const rows=snapshot.rows;assert.equal(rows.length,189);assert.equal(rows[0].period,'2011-01');assert.equal(rows.at(-1).period,'2026-09');assert.equal(new Set(rows.map(r=>r.period)).size,rows.length);
 for(let i=0;i<rows.length;i++){for(const key of ['general','materials','labor']){assert(rows[i][key]>0);assert(Number.isFinite(rows[i][key+'Monthly']));}if(i){const [year,month]=rows[i-1].period.split('-').map(Number);assert.equal(rows[i].period,`${year+(month===12?1:0)}-${String(month%12+1).padStart(2,'0')}`);}}
});
test('latest publication and corrected months match September source values',()=>{
 const latest=snapshot.rows.at(-1);assert.equal(latest.general,23607.5);assert.equal(latest.materials,25714.3);assert.equal(latest.labor,20519.6);assert.equal(latest.generalMonthly,2.9);assert.equal(latest.provisional,true);
 assert.equal(snapshot.rows.find(r=>r.period==='2026-05').labor,17423.2);
 assert.equal(snapshot.rows.find(r=>r.period==='2026-06').general,21734.5);
 assert.equal(snapshot.rows.find(r=>r.period==='2026-07').general,22053);
});
test('annual and year-to-date changes use index ratios, not monthly percentage sums',()=>{
 assert.equal(Number(cac.cacVariation('2026-09','general','yearToDate').toFixed(1)),25.7);
 assert.equal(Number(cac.cacVariation('2026-09','general','annual').toFixed(1)),32.9);
 assert.equal(cac.cacVariation('2011-01','general','annual'),null);
 assert.equal(cac.cacPeriod('2026-09'),'septiembre de 2026');
});
test('download has one header plus all 189 months and preserves Spanish decimal values',async()=>{
 const route=load('app/blog/indice-cac/historico.csv/route.ts',{'@/lib/cac':cac});const response=await route.GET(),text=await response.text();assert.match(response.headers.get('content-type'),/text\/csv/);assert.equal(text.trim().split(/\r?\n/).length,190);assert.match(text,/2026-09;23607,5;2,9;25714,3;3,5;20519,6;1,7;Si/);
});
test('year selector initially renders latest year with accessible table and all three series',()=>{
 const {CacHistory}=load('components/cac-history.tsx',{'@/lib/cac':cac});const html=require('react-dom/server').renderToStaticMarkup(require('react').createElement(CacHistory));assert.match(html,/value="2026" selected/);assert.match(html,/septiembre de 2026/);assert.match(html,/23.607,5/);assert.match(html,/Mano de obra/);assert.match(html,/aria-label="Tabla del índice CAC de 2026/);
});
