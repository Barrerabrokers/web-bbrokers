/* Deployment preflight: synthetic conversations only; never invokes WhatsApp delivery or CRM writes. */
const fs=require('fs'),vm=require('vm'),ts=require('typescript'),path=require('path'),assert=require('assert/strict');
const cache=new Map();
function load(file){if(cache.has(file))return cache.get(file);const module={exports:{}};cache.set(file,module.exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(process.cwd(),file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>n.startsWith('@/')?load(n.replace('@/','')+'.ts'):require(n),console,process,fetch,AbortSignal,Date,URL,Set,Map,TextEncoder,TextDecoder,Buffer});return module.exports;}
(async()=>{
  if(!process.env.GROQ_API_KEY)throw Error('Preflight requires the configured Groq provider');
  const {generateGroqCustomerReply}=load('lib/whatsapp-ai-provider.ts');
  const {generateSalesDialogue,salesDialogueCorrection}=load('lib/whatsapp-sales-dialogue.ts');
  const {buildCompactSalesInstructions,buildBudgetSalesInstructions,compactSalesInput}=load('lib/whatsapp-sales-context.ts');
  const {salesTurnViolations}=load('lib/whatsapp-sales-turn.ts');
  const catalog={details:[{name:'Alpha Place Belgrano',slug:'alpha-place-belgrano',explicitlyMentioned:true,operatorKnowledge:{constructionStage:'En obra, hormigón del piso 7',referenceUnits:[{unit:'203',rooms:1,floor:2,totalArea:41,currency:'USD',downPayment:53870,months:30,monthlyPayment:2900,sourceStatus:'LIBRE'}],priceList:{referenceOnly:true},financingMaxInstallments:30}}]};
  const history=[{direction:'inbound',senderType:'customer',status:'received',content:'Busco 2 ambientes en Alpha Place Belgrano para vivir.'},{direction:'outbound',senderType:'agent',status:'sent',content:'Tengo una opción en el 2do piso, UF 203. 41m2 Totales con 4m2 de balcón. Anticipo U$S 53.870 + 30 pagos de U$S 2.900'},{direction:'outbound',senderType:'agent',status:'sent',content:'Te envío el plano de esa unidad.'}];
  const turns=['Gracias pero me parece caro el m2','Lo comparo con uno terminado en otro barrio, pero sin financiación.','Prefiero financiar porque no quiero usar todos mis ahorros. Lo importante para mí es una cuota cómoda.'];
  for(let index=0;index<turns.length;index++){
    history.push({direction:'inbound',senderType:'customer',status:'received',content:turns[index]});
    const instructions=buildCompactSalesInstructions(history,{},catalog,[],turns[index]),backup=buildBudgetSalesInstructions(history,{},catalog),input=compactSalesInput(history);
    const reply=await generateSalesDialogue(async correction=>{const extra=correction?salesDialogueCorrection(correction):'';const draft=await generateGroqCustomerReply(instructions+extra,input,backup+extra,{timeoutMs:correction?10000:20000,reasoningEffort:'medium'});console.log('sales-dialogue-live-draft',JSON.stringify({turn:index+1,repair:!!correction,draft}));return draft;},history,catalog);
    console.log('sales-dialogue-live-candidate',JSON.stringify({turn:index+1,reply}));
    assert.equal(salesTurnViolations(reply,history,catalog).length,0);
    assert.ok(!/no encuentro en la lista|alternativa compatible|que proyecto te interesa/i.test(reply));
    assert.ok(!history.filter(m=>m.direction==='outbound').some(m=>m.content===reply));
    if(index===0)assert.ok(/compar|referencia|valor|precio|m[²2]|metro/i.test(reply));
    if(index===1)assert.ok(/barrio|zona|terminad|financi|cuotas|contado/i.test(reply));
    if(index===2)assert.ok(/cuota|mensual|anticipo|financi/i.test(reply));
    history.push({direction:'outbound',senderType:'ai',status:'sent',content:reply});
    console.log('sales-dialogue-live-check',JSON.stringify({turn:index+1,reply}));
  }
  console.log('sales-dialogue-live-check:PASS:3-turns:no-client-messages');
})().catch(e=>{console.error('sales-dialogue-live-check:FAIL',e.message);process.exit(1);});
