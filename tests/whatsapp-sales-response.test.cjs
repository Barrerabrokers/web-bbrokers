const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');function load(file){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>n.startsWith('@/')?load(n.replace('@/','')+'.ts'):require(n)});return module.exports;}const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/whatsapp-sales-response.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:n=>n.startsWith('@/')?load(n.replace('@/','')+'.ts'):require(n)});const api=m.exports;const cat={details:[{name:'Feel Recoleta',slug:'feel-recoleta',explicitlyMentioned:true,brochure_url:'https://drive.google.com/verified'}]};
test('blocks invented 60 month plan and showroom before sending',()=>{const r=api.finalizeSalesReply('Con 60 meses ajustamos la cuota. ¿Visitamos el showroom?',[],cat);assert.ok(r.includes('hasta 36 cuotas'));assert.ok(!/60|showroom/.test(r));assert.ok(r.includes('https://barrerabrokers.com/desarrollos/feel-recoleta/brochure'));});
test('blocks long tables and multiple questions',()=>{assert.ok(api.salesReplyViolations('¿Zona? ¿Presupuesto?',false).length);assert.ok(api.salesReplyViolations('detalle '.repeat(100),false).length);});
test('retains concise relevant response and sends brochure only once',()=>{const url='https://barrerabrokers.com/desarrollos/feel-recoleta/brochure';const r=api.finalizeSalesReply('La financiación es anticipo y 36 cuotas.',[{direction:'outbound',content:url}],cat);assert.equal(r,'La financiación es anticipo y 36 cuotas.');assert.ok(api.finalizeSalesReply('Te comparto el brochure.',[{direction:'outbound',content:url},{direction:'inbound',content:'Mandame el brochure'}],cat).includes(url));});
test('does not attach sales material to opt-out',()=>assert.equal(api.finalizeSalesReply('Entendido.',[{direction:'inbound',content:'No me contactes'}],cat),'Entendido.'));
test('wrong Palermo focus and repeated qualification are blocked for Recoleta request',()=>{const messages=[{direction:'inbound',content:'Ambientes: 2 ambientes\nPresupuesto: Anticipo USD 90.000 + cuotas USD 3.800'},{direction:'inbound',content:'Me gustó Palermo! No sé qué tienen en Recoleta.'}];for(const bad of ['Entiendo, nos centramos en Feel Palermo.','¿Cuántos ambientes necesitás?','¿Cuál es tu presupuesto?']){const r=api.finalizeSalesReply(bad,messages,cat);assert.ok(r.includes('Pueyrredón y French'));assert.ok(!r.includes('nos centramos en Feel Palermo'));}});
test('personal inheritance disclosure does not trigger automatic brochure; explicit request does',()=>{const personal=[{direction:'inbound',content:'Me dejó una herencia'}];const reply=api.finalizeSalesReply('Gracias por contármelo. ¿Querés revisar una propuesta con calma?',personal,cat);assert.ok(!reply.includes('/brochure'));const requested=api.finalizeSalesReply('Te comparto el brochure.',[{direction:'inbound',content:'Recibí una herencia, mandame el brochure de Recoleta'}],cat);assert.ok(requested.includes('/brochure'));});
test('brochure Markdown and trailing parentheses become a clean standalone WhatsApp URL',()=>{const url='https://barrerabrokers.com/desarrollos/feel-recoleta/brochure';for(const bad of [`[Brochure](${url})`,`Brochure: ${url})`,`Brochure: (${url}).`]){const r=api.finalizeSalesReply(bad,[],cat);assert.ok(r.split('\n').includes(url),r);assert.ok(!r.includes(url+')'),r);assert.ok(!r.includes(']('),r);}});
test('bad wrappers are corrected even when brochure was previously sent',()=>{const url='https://barrerabrokers.com/desarrollos/feel-recoleta/brochure';const r=api.finalizeSalesReply(`[Brochure](${url})`,[{direction:'outbound',content:url}],cat);assert.ok(r.split('\n').includes(url));assert.ok(!r.includes(url+')'));});
test('yes to proposal and high floor correction produce a compatible unit instead of restarting',()=>{const url='https://barrerabrokers.com/desarrollos/feel-recoleta/brochure';const c={details:[{...cat.details[0],operatorKnowledge:{priceList:{currentValidityConfirmed:true},referenceUnits:[{unit:'101',floor:1,rooms:3,totalArea:81.9,downPayment:101160,months:36,monthlyPaymentReference:4215,price:252900,currency:'USD',sourceStatus:'LIBRE'},{unit:'801',floor:8,rooms:3,totalArea:81.9,downPayment:115080,months:36,monthlyPaymentReference:4795,price:287700,currency:'USD',sourceStatus:'LIBRE'}]}}]};const messages=[{direction:'inbound',content:'Quiero Feel Recoleta'},{direction:'outbound',content:`${url}\n¿Querés que te envíe la propuesta detallada?`},{direction:'inbound',content:'si 3 ambientes'},{direction:'inbound',content:'piso alto'},{direction:'outbound',content:'Unidad 101, piso 1.'},{direction:'inbound',content:'Te pedi piso alto no me gustan los pisos bajos'}];for(const bad of ['Unidad 101: 3 ambientes, piso 1.','Feel Recoleta está en Pueyrredón y French. ¿Avanzamos con una propuesta según tu búsqueda?']){const reply=api.finalizeSalesReply(bad,messages,c);assert.ok(reply.includes('Unidad 801'),reply);assert.ok(reply.includes('piso 8'),reply);assert.ok(reply.includes('115.080'),reply);assert.ok(!reply.includes('¿Avanzamos'),reply);assert.ok(!reply.includes('brochure'),reply);}const historical=api.finalizeSalesReply('Te pasé la unidad 101, en el piso 1.',[...messages,{direction:'inbound',content:'que piso me pasaste?'}],c);assert.ok(historical.includes('piso 1'));});

test('budget rejection never repeats an unaffordable unit or invents financing',()=>{
 const unit={unit:'601',floor:6,rooms:3,totalArea:69.6,downPayment:111120,months:36,monthlyPaymentReference:4630,price:277800,currency:'USD',sourceStatus:'LIBRE'};
 const c={details:[{...cat.details[0],operatorKnowledge:{referenceUnits:[unit]}},{name:'Alpha Place Belgrano',slug:'alpha-place-belgrano',operatorKnowledge:{referenceUnits:[{...unit,unit:'203',floor:2,rooms:1,downPayment:38691,months:30,monthlyPaymentReference:2100}]}}]};
 const prior=[{direction:'inbound',content:'Feel Recoleta, 3 ambientes, piso 6 para arriba. Anticipo 35.000'},{direction:'outbound',content:'Unidad 601: anticipo U$S 111.120.'}];
 for(const content of ['No me alcanza','No llego','Que me alcanza con mi presupuesto?','No me alcanza que otra opcion para invertir tengo?']){
  const r=api.finalizeSalesReply('Unidad 601: anticipo U$S 111.120.',[...prior,{direction:'inbound',content}],c);
  assert.ok(!r.includes('111.120'),r);assert.ok(!r.includes('Unidad 601'),r);assert.ok(r.includes('38.691'),r);assert.ok(r.includes('no cumple'),r);assert.ok(!r.includes('brochure'),r);
 }
 const affordable={...c,details:[{...c.details[0],operatorKnowledge:{referenceUnits:[unit,{...unit,unit:'701',floor:7,downPayment:30000,monthlyPaymentReference:2000}]}}]};
 const r=api.finalizeSalesReply('Unidad 601', [...prior,{direction:'inbound',content:'No llego'}],affordable);assert.ok(r.includes('Unidad 701'),r);assert.ok(r.includes('30.000'),r);assert.ok(!r.includes('601'),r);
});

test('three rooms beyond budget offers an affordable studio as a conditional first step',()=>{
 const expensive={unit:'601',floor:6,rooms:3,totalArea:69.6,downPayment:111120,months:36,monthlyPaymentReference:4630,price:277800,currency:'USD',sourceStatus:'LIBRE'};
 const studio={...expensive,unit:'203',floor:2,rooms:1,totalArea:30,balconyArea:5,downPayment:38691,months:30,monthlyPaymentReference:2100};
 const c={details:[{...cat.details[0],operatorKnowledge:{referenceUnits:[expensive]}},{name:'Alpha Place Belgrano',slug:'alpha-place-belgrano',operatorKnowledge:{referenceUnits:[studio]}}]};
 const messages=[{direction:'inbound',content:'Feel Recoleta. 3 ambientes. Piso 6 para arriba. Anticipo USD 40.000 + cuotas USD 2.200'},{direction:'inbound',content:'No me alcanza'}];
 const r=api.finalizeSalesReply('Unidad 601',messages,c);
 assert.ok(r.includes('Unidad Monoambiente'),r);assert.ok(r.includes('38.691 + 30 pagos de U$S 2.100'),r);assert.ok(r.includes('podrías revender'),r);assert.ok(r.includes('saldos y costos'),r);assert.ok(!r.includes('111.120'),r);
 const tooLow=messages.map(m=>({...m,content:m.content.replace('2.200','1.900')}));assert.ok(!api.finalizeSalesReply('Unidad 601',tooLow,c).includes('Como primer paso'));
});

test('keeps a verified AI budget recommendation rather than overwriting it with a script',()=>{
 const unit={unit:'203',floor:2,rooms:1,totalArea:30,balconyArea:5,downPayment:38691,months:30,monthlyPaymentReference:2100,price:101691,currency:'USD',sourceStatus:'LIBRE'};
 const c={details:[{name:'Alpha Place Belgrano',slug:'alpha-place-belgrano',operatorKnowledge:{referenceUnits:[unit]}}]};
 const messages=[{direction:'inbound',content:'3 ambientes. Anticipo USD 40.000 + cuotas USD 2.200'},{direction:'inbound',content:'No me alcanza'}];
 const text='Para empezar con una alternativa menor en Alpha Place Belgrano:\nUnidad Monoambiente de 30m2 Totales, con 5m2 de Balcón.\nAnticipo U$S 38.691 + 30 pagos de U$S 2.100.\nPodrías evaluar una unidad mayor después de vender, según saldos y costos. Valores y disponibilidad a confirmar.';
 assert.equal(api.finalizeSalesReply(text,messages,c),text);
 assert.ok(!api.groundedBudgetRecommendation(text.replace('38.691','30.000'),messages,c));
 assert.ok(!api.groundedBudgetRecommendation(text.replace('30m2','45m2'),messages,c));
 assert.deepEqual(Array.from(api.salesReplyViolations('Feel Recoleta no tiene showroom.',true)),[]);
});

test('keeps a natural grounded explanation when there is no affordable option',()=>{
 const c={details:[{name:'Alpha Place Belgrano',slug:'alpha-place-belgrano',operatorKnowledge:{referenceUnits:[{unit:'203',rooms:1,sourceStatus:'LIBRE',currency:'USD',downPayment:38691,months:30,monthlyPaymentReference:2100}]}}]};
 const messages=[{direction:'inbound',content:'Anticipo USD 35.000. 3 ambientes'},{direction:'inbound',content:'No me alcanza'}];
 const text='Buscás 3 ambientes, pero con U$S 35.000 de anticipo no encuentro una opción en las listas actuales. Tampoco hay un monoambiente dentro de ese monto. Un asesor tendría que verificar otros desarrollos para seguir tu búsqueda.';
 assert.equal(api.finalizeSalesReply(text,messages,c),text);
});

test('brochure sent as an administrator attachment is remembered without adding the same link',()=>{
 const messages=[{direction:'inbound',content:'Quiero Feel Recoleta, mandame el brochure'},{direction:'outbound',senderType:'agent',content:'Te comparto el brochure.',attachment:{type:'document',filename:'brochure.pdf',mimeType:'application/pdf',size:500,storagePath:'conversation/file.pdf'}},{direction:'inbound',content:'¿Cuántas cuotas tiene?'}];
 const r=api.finalizeSalesReply('Feel Recoleta se financia con anticipo y hasta 36 cuotas.',messages,cat);
 assert.ok(!r.includes('/brochure'),r);
});
