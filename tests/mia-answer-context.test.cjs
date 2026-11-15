const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
function load(file){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>n.startsWith('@/')?load(n.replace('@/','')+'.ts'):require(n),Intl,Date});return module.exports;}
const api=load('lib/mia-answer-context.ts');
const unit={project:'Proyecto prueba',unit:'UF 104',price:130325,currency:'USD',down:52130,months:30,installment:2606.5,source:'https://docs.google.com/spreadsheets/d/source',readAt:new Date().toISOString(),adjustment:'Cuotas sujetas a CAC.',area:'35 m²',deliveryMonths:30,planUrls:['https://example.com/exact-plan.pdf']},state={stage:'unidades_presentadas',facts:{neighborhoods:['Núñez']},offers:[unit]};
test('natural answers bind exact retrieved amounts and always retain adjustment',()=>{
 const result=api.renderMiaAnswerTokens('El anticipo es {{oferta1.anticipo}} y el saldo en {{oferta1.pagos}}.',state);
 assert.equal(result.text,'El anticipo es USD 52.130 y el saldo en 30 pagos de USD 2.606,50.\nCuotas sujetas a CAC.');assert(!/\d|USD/.test(result.checkText));assert(!result.text.includes('docs.google'));
});
test('fresh exact unit data supersedes the earlier quote without mixing neighboring units or projects',()=>{
 const fresh=[{...unit,unit:'105',down:1},{...unit,project:'Otro proyecto',down:2},{...unit,unit:'104',down:53000}];
 assert(api.renderMiaAnswerTokens('Anticipo: {{oferta1.anticipo}}',state,fresh).text.includes('53.000'));
});
test('missing data, invented fields, banking details and nonexisting offers cannot be interpolated',()=>{
 for(const token of ['{{oferta3.precio}}','{{oferta1.cbu}}','{{oferta1.source}}','{{elegida.precio}}','{{oferta1.desarrollo}}'])assert.equal(api.renderMiaAnswerTokens('Revisá '+token,state),undefined);
 assert.equal(api.renderMiaAnswerTokens('Anticipo {{oferta1.anticipo}}',{...state,offers:[{...unit,readAt:undefined,source:undefined}]}),undefined);
});
test('customer memory accumulates explicit concerns and needs across turns, deduplicates and excludes private identifiers',()=>{
 let next={...state,memory:api.rememberMiaNotes(state,[{kind:'concern',evidence:'me preocupa comprar en obra'}],'me preocupa comprar en obra')};
 next.memory=api.rememberMiaNotes(next,[{kind:'need',evidence:'quiero que administren la renta'},{kind:'concern',evidence:'me preocupa comprar en obra'},{kind:'need',evidence:'DNI 12345678'},{kind:'need',evidence:'dato inventado'}],'quiero que administren la renta, me preocupa comprar en obra. DNI 12345678');
 assert.equal(next.memory.notes.length,2);assert.equal(next.memory.notes[0].text,'me preocupa comprar en obra');assert.equal(state.memory,undefined);
 const context=api.miaAnswerContext(next);assert(context.memory.some(n=>n.text.includes('renta')));assert(!JSON.stringify(context).includes(unit.source));
});
test('old proposal amounts require a fresh matching source instead of being reused indefinitely',()=>{
 const old={...state,offers:[{...unit,readAt:new Date(Date.now()-48*60*60*1000).toISOString()}]};
 assert.equal(api.renderMiaAnswerTokens('Anticipo {{oferta1.anticipo}}',old),undefined);
 assert(api.renderMiaAnswerTokens('Anticipo {{oferta1.anticipo}}',old,[{...unit,down:53000}]).text.includes('53.000'));
});
test('the model sees verified attributes for comparisons and only tokens for data actually available',()=>{
 const context=api.miaAnswerContext(state);assert.equal(context.units[0].financial.price,130325);assert.equal(context.units[0].area,'35 m²');assert(context.units[0].tokens.includes('{{oferta1.anticipo}}'));assert(!context.units[0].tokens.includes('{{oferta1.desarrollo}}'));
 const old=api.miaAnswerContext({...state,offers:[{...unit,readAt:'2000-01-01'}]});assert.equal(old.units[0].financial,undefined);assert(!old.units[0].tokens.includes('{{oferta1.precio}}'));
});
