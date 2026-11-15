// Synthetic read-only conversation. No contact writes, WhatsApp sends or reservations.
const fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript'),assert=require('node:assert/strict');
const resolve=Module._resolveFilename;Module._resolveFilename=function(id,parent,...rest){return resolve.call(this,id.startsWith('@/')?path.join(process.cwd(),id.slice(2)):id,parent,...rest);};
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {runMiaAgent}=require('../lib/mia-agent.ts'),{getMiaTrialConfig}=require('../lib/mia-project-trial.ts');
(async()=>{
 const config=await getMiaTrialConfig();let memory;
 const dialogue=[{direction:'outbound',content:'9 de Julio Estudios 3 · Unidad 1A'},{direction:'outbound',content:'9 de Julio Estudios 3 · Unidad 3A'}];
 for(const [text,expected] of [['3 A',/seguimos con la unidad 3A/],['Quiero reservar esa unidad',/Todavía no hay una reserva confirmada/],['cuantas cuotas se pueden hacer',/financiación|condiciones publicadas/],['Mandame el plano',/mia-unit-plan.*unit=3A/]]){
  dialogue.push({direction:'inbound',content:text});
  const result=await runMiaAgent(dialogue,config,'',{memory});memory=result.memory;
  assert.equal(memory.selectedUnit?.unit,'3A','Selected unit was lost');assert.match(result.reply,expected);assert.doesNotMatch(result.reply,/vivir o.*invertir|qué tipo de unidad/);
  console.log('MIA_CONTINUITY_SMOKE',JSON.stringify({question:text,reply:result.reply,selected:memory.selectedUnit.unit,pending:memory.pendingQuestions.length}));
  dialogue.push({direction:'outbound',content:result.reply});
 }
 console.log('MIA_CONTINUITY_SMOKE: selected unit, reservation request, financing and exact floor plan passed. No clients or bookings modified.');
})().catch(e=>{console.error('MIA_CONTINUITY_SMOKE failed:',e.message);process.exitCode=1;});
