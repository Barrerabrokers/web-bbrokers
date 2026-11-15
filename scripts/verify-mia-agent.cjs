// Synthetic end-to-end provider + official sources check. Read-only: no client
// sends, CRM writes, calendar events or invitations. Runs only when opted in.
const fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript'),assert=require('node:assert/strict');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(id,parent,...rest){return resolve.call(this,id.startsWith('@/')?path.join(process.cwd(),id.slice(2)):id,parent,...rest);};
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {runMiaAgent}=require('../lib/mia-agent.ts'),{getMiaTrialConfig}=require('../lib/mia-project-trial.ts'),{splitMiaReplyMessages}=require('../lib/mia-reply-messages.ts');
(async()=>{
 const config=await getMiaTrialConfig();let memory;const dialogue=[],shown=new Set();
 const cases=[
  {text:'Busco dos ambientes en Núñez para vivir. Puedo dar hasta 140 mil dólares de anticipo y pagar hasta 7000 dólares por mes. Me sirve en obra. Armame una propuesta con dos opciones: mi prioridad es la menor cuota mensual.',rooms:2,parts:2},
  {text:'Mostrame otra opción con lo mismo.',rooms:2,parts:1,more:true},
  {text:'No, cambiemos a un ambiente, en Núñez y con el mismo anticipo y cuota máxima.',rooms:1,parts:2},
  {text:'Ahora necesito entrega inmediata, sin cambiar de barrio ni tipología.',rooms:1,parts:1,immediate:true},
 ];
 for(let i=0;i<cases.length;i++){
  if(i)await new Promise(r=>setTimeout(r,23000));
  const c=cases[i];dialogue.push({direction:'inbound',content:c.text});
  const result=await runMiaAgent(dialogue,config,'',{memory});memory=result.memory;console.log('MIA_AGENT_SMOKE_PLAN',JSON.stringify({case:i+1,preferences:memory.preferences}));
  assert(!/No pude verificar|No pude consultar|Para orientarte bien/.test(result.reply),'Agent fallback in case '+(i+1));
  assert.deepEqual(memory.preferences.rooms,[c.rooms],'Room correction/memory');
  assert(memory.preferences.neighborhoods.some(n=>n.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()==='nunez'),'Neighborhood lost');
  assert.equal(memory.preferences.down.amount,140000,'Down payment lost');assert.equal(memory.preferences.monthly.amount,7000,'Monthly budget lost');assert.equal(memory.preferences.total,null,'Down/monthly mistaken for total');
  if(i===0){assert.equal(memory.preferences.purpose,'living','Living objective lost');assert.equal(memory.priority,'monthly','Explicit monthly priority lost');}
  const parts=splitMiaReplyMessages(result.reply);assert.equal(parts.length,c.parts,'Wrong message split');
  if(c.immediate){assert.equal(memory.preferences.delivery,'immediate');assert(!/Precio de lista:/.test(result.reply),'Construction offered as immediate');}
  else{
   for(const part of parts){assert.equal((part.match(/Precio de lista:/g)||[]).length,1,'Not one unit per message');assert.match(part,/Alpha Place Libertador/);}
   if(c.more)for(const q of memory.lastOffered)assert(!shown.has(q.key),'Repeated offered unit');
   memory.lastOffered.forEach(q=>shown.add(q.key));
  }
  console.log('MIA_AGENT_SMOKE',JSON.stringify({case:i+1,preferences:memory.preferences,messages:parts}));
  dialogue.push(...parts.map(content=>({direction:'outbound',content})));
 }
 console.log('MIA_AGENT_SMOKE: semantic search, budget memory, another unit, room correction and immediate-delivery exclusion passed. No client messages or events.');
})().catch(error=>{console.error('MIA_AGENT_SMOKE failed:',error.message);process.exitCode=1;});
