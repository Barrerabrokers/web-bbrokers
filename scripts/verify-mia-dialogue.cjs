// Explicit build-time smoke test. Synthetic messages only; no database or channel writes.
const fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript'),assert=require('node:assert/strict');
if(!process.env.GROQ_API_KEY)throw Error('MIA_SMOKE: provider credential unavailable');
const cache=new Map(),mocks={
 '@/lib/mia-website-context':{loadMiaWebsiteContext:async query=>({references:query.includes('Prueba Web')?[{title:'Web Barrera Brokers · Prueba Web',url:'https://barrerabrokers.com/desarrollos/prueba-web',text:'Amenities publicados: gimnasio y terraza.'}]:[],issues:[]})},
 '@/lib/mia-guidance':{getMiaGuidance:async()=>({instructions:'',corrections:[]}),miaGuidancePrompt:()=>''},
 '@/lib/whatsapp-admin-learning':{listAdministratorLearning:async()=>[]},
 '@/lib/whatsapp-mia-sources':{loadMiaSourceContext:async()=>({references:[],issues:[]})}
};
function load(file){const filename=path.resolve(file);if(cache.has(filename))return cache.get(filename).exports;const m=new Module(filename,module);cache.set(filename,m);m.filename=filename;m.paths=Module._nodeModulePaths(process.cwd());m.require=function(name){return mocks[name]||(name.startsWith('@/')?load(name.replace('@/','')+'.ts'):Module.prototype.require.call(this,name));};m._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);return m.exports;}
(async()=>{
 const provider=load('lib/whatsapp-ai-provider.ts'),real=provider.generateGroqCustomerReply;
 let jsonResponses=0;provider.generateGroqCustomerReply=async(...args)=>{if(jsonResponses===2||jsonResponses===4){console.log('MIA_SMOKE pacing to respect provider minute quota');await new Promise(resolve=>setTimeout(resolve,60000));}const raw=await real(...args);const value=JSON.parse(raw);assert.equal(typeof value.reply,'string');jsonResponses++;return raw;};
 const consultant=load('lib/mia-consultative.ts');
 const base={stage:'conversacion_comercial',facts:{neighborhoods:['Núñez'],rooms:2,deliveryMonths:36,budget:{original:'formulario',down:60000,monthly:2500}},offers:[]};
 let current=base;
 const inbound=content=>({direction:'inbound',content,status:'received'}),history=[];
 for(const text of ['Me da miedo comprar en obra, es la primera vez que invierto','¿Ustedes pueden administrar la renta después de la entrega?','¿Qué te había dicho que me preocupaba?']){
  history.push(inbound(text));if(text.includes('había dicho'))assert(current.memory?.notes.length,'No persistent customer memory');const result=await consultant.advanceMiaConsultative(current,text,text.includes('había dicho')?[inbound(text)]:history,{projectsUrl:''},async()=>{throw Error('Unexpected inventory request')},{manualPause:true});
  assert(!result.handoff);assert(result.reply.length<=650);assert(!/^Contame, ¿en qué zona|^¿Tenés algún barrio/.test(result.reply),'Model reply was replaced with fallback');
  if(text.includes('administrar'))assert(/administr|check|limpieza|ropa blanca/i.test(result.reply));
  if(text.includes('había dicho'))assert(/obra|miedo|preocup/i.test(result.reply));
  current=result.next;
  console.log('MIA_SMOKE conversational:',result.reply);history.push({direction:'outbound',content:result.reply,status:'sent'});
 }
 const webText='¿Qué amenities publicados tiene Prueba Web?';
 const web=await consultant.advanceMiaConsultative(base,webText,[inbound(webText)],{projectsUrl:''},async()=>{throw Error('Unexpected search instead of answering website question')},{manualPause:true});
 assert(/gimnasio|terraza/i.test(web.reply));console.log('MIA_SMOKE website:',web.reply);
 const unit={project:'Proyecto de prueba',unit:'104',rooms:2,price:130325,currency:'USD',down:52130,months:30,installment:2606.5,source:'https://example.com/synthetic-source',readAt:new Date().toISOString(),adjustment:'Cuotas sujetas a CAC.'};
 const price=await consultant.advanceMiaConsultative({...base,stage:'unidades_presentadas',offers:[unit]},'¿Cuánto es el anticipo de la primera opción?',[inbound('¿Cuánto es el anticipo de la primera opción?')],{projectsUrl:''},async()=>{throw Error('Unexpected search')},{manualPause:true});
 assert(price.reply.includes('USD 52.130'));assert(price.reply.includes('CAC'));assert(!/[{}]/.test(price.reply));console.log('MIA_SMOKE verified amount:',price.reply);
 const zoneText='¿Qué me contás de Recoleta para vivir?';
 const zone=await consultant.advanceMiaConsultative(base,zoneText,[inbound(zoneText)],{projectsUrl:''},async()=>{throw Error('Unexpected search instead of explaining neighborhood')},{manualPause:true});
 console.log('MIA_SMOKE neighborhood actual:',zone.reply);assert(/Bellas Artes|Centro Cultural|Plaza Francia|cultur|museo|plaza/i.test(zone.reply));assert(!/garantiz|\d.*%/.test(zone.reply));console.log('MIA_SMOKE neighborhood:',zone.reply);
 assert.equal(jsonResponses,6);console.log('MIA_SMOKE PASS: real provider, 6 structured replies, memory, website, neighborhood and verified amount; no customer writes');

})().catch(error=>{console.error('MIA_SMOKE FAILED:',error.message);process.exitCode=1});
