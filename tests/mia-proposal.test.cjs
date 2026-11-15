const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
function load(file){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>n.startsWith('@/')?load(n.replace('@/','')+'.ts'):require(n),Intl,Date,process,console,URL,Buffer});return module.exports;}
const {renderMiaProposal}=load('lib/mia-proposal.ts'),{applyMiaUnitPresentation}=load('lib/mia-unit-presentation.ts');
const unit={project:'Alpha Place Libertador',unit:'104',rooms:1,floor:'1',area:'35 m² (Propia/Unidad m² / Private area per unit m²)',price:130325,currency:'USD',down:52130,months:30,installment:2606.5,deliveryMonths:36,source:'https://docs.google.com/spreadsheets/d/private',row:5,readAt:'2026-10-17',website:'https://barrerabrokers.com/desarrollos/alpha-place-libertador',planUrls:['https://example.invalid/104.jpg']};
const approved=[{project:unit.project,unit:'104',totalArea:35,balconyArea:3,deliveryMinMonths:24,deliveryMaxMonths:30,confirmedAt:'2026-10-17'}];
test('approved single-unit message is brief and preserves precise payment, delivery and actual links',()=>{
 const reply=renderMiaProposal([applyMiaUnitPresentation(unit,approved)],1);
 assert(reply.includes('Unidad 104 de 1 ambiente'));assert(reply.includes('35 m² totales (incluye 3 m² de balcón)'));assert(reply.includes('USD 52.130 + 30 pagos de USD 2.606,5'));assert(reply.includes('entre 24 y 30 meses'));assert(reply.includes(unit.website));assert(reply.includes(unit.planUrls[0]));assert(reply.includes('más grande o en un piso más alto'));
 for(const bad of ['sin inventar','límites informados','presupuesto registrado','Private area','Precio de lista','130.325','según la planilla','Fuente:','Disponibilidad según'])assert(!reply.includes(bad),bad);
 assert(reply.split(/\s+/).length<110);
});
test('administrator approval is scoped to exact project and unit and never changes financial source facts',()=>{
 const changed=applyMiaUnitPresentation(unit,approved);assert.equal(changed.price,unit.price);assert.equal(changed.installment,2606.5);assert.equal(changed.deliveryMonths,30);
 for(const other of [{...unit,unit:'204'},{...unit,project:'Otro'}]){const result=applyMiaUnitPresentation(other,approved);assert.equal(result.deliveryMonths,36);assert(!result.presentation);}
 assert.equal(applyMiaUnitPresentation(unit,[{...approved[0],deliveryMaxMonths:12}]).deliveryMonths,36);
});
test('short messages still disclose budget excess and variable installment adjustments',()=>{
 const reply=renderMiaProposal([{...unit,price:105000,originalBudget:100000,adjustment:'Cuotas pesificadas y ajustadas por CAC; no son cuotas fijas en USD.'}]);assert(reply.includes('Supera tu presupuesto en USD 5.000 (5 %)'));assert(reply.includes('CAC'));assert(reply.includes('no son cuotas fijas'));
});
test('cash options show the real amount and never invent down payments or installments',()=>{
 const reply=renderMiaProposal([{...unit,cash:true,down:undefined,months:undefined,installment:undefined}]);assert(reply.includes('Contado: USD 130.325'));assert(!reply.includes('Anticipo:'));assert(!reply.includes('pagos de'));
});
test('two real options and alternative typology remain clearly distinguished',()=>{
 const reply=renderMiaProposal([unit,{...unit,unit:'804',price:140000}],2,1);assert(reply.includes('ampliar la búsqueda de 2 ambientes'));assert(reply.includes('alternativa de 1 ambiente'));assert(reply.includes('Unidad 104'));assert(reply.includes('Unidad 804'));assert(reply.includes('mayor precio'));assert(!reply.includes('docs.google'));
});
