// Deployment-only smoke test. Uses the normal provider, public project sources and
// synthetic dialogue. Never sends WhatsApp messages or modifies a CRM contact.
const fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript'),assert=require('node:assert/strict');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(id,parent,...rest){return resolve.call(this,id.startsWith('@/')?path.join(process.cwd(),id.slice(2)):id,parent,...rest);};
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {generateMiaProjectTrial,getMiaTrialConfig}=require('../lib/mia-project-trial.ts');
const {splitMiaReplyMessages}=require('../lib/mia-reply-messages.ts');
(async()=>{
 const config={...await getMiaTrialConfig(),enabled:true};
 const dialogue=[];
 const cases=[
  {question:'Mostrame dos unidades disponibles de Alpha Place Belgrano con su precio, cada una por separado, y compartime su brochure.',expected:/1yhd7DBosXjnYqEJccvHIRP5a-jc_Jmyf/},
 ];
 for(let i=0;i<cases.length;i++){
  if(i)await new Promise(r=>setTimeout(r,23000));
  const c=cases[i];dialogue.push({direction:'inbound',content:c.question});
  const reply=await generateMiaProjectTrial(dialogue,config);
  assert(!/No pude verificar|No pude consultar/.test(reply),'Unverified response in smoke case '+(i+1));
  assert.match(reply,c.expected,'Wrong project or document in smoke case '+(i+1));
  assert(!/\[\[|\]\]/.test(reply),'Unresolved source token');
  const parts=splitMiaReplyMessages(reply);
  assert.equal(parts.length,2,'Each unit must be a separate message');
  for(const part of parts)assert.equal((part.match(/Precio de lista:/g)||[]).length,1,'One verified unit per message');
  dialogue.push(...parts.map(content=>({direction:'outbound',content})));

  console.log('MIA_TRIAL_SMOKE',JSON.stringify({case:i+1,question:c.question,messages:parts}));
 }
 console.log('MIA_TRIAL_SMOKE: dos unidades verificadas en mensajes separados y ordenados; sin envíos a clientes.');
})().catch(error=>{console.error('MIA_TRIAL_SMOKE failed:',error.message);process.exitCode=1;});
