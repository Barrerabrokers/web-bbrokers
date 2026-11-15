// Real provider/source check on a synthetic conversation; no client writes or sends.
const fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript'),assert=require('node:assert/strict');
const resolve=Module._resolveFilename;Module._resolveFilename=function(id,parent,...rest){return resolve.call(this,id.startsWith('@/')?path.join(process.cwd(),id.slice(2)):id,parent,...rest);};
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
(async()=>{const {runMiaAgent}=require('../lib/mia-agent.ts'),{getMiaTrialConfig}=require('../lib/mia-project-trial.ts');
const result=await runMiaAgent([{direction:'inbound',content:'Estoy buscando un departamento en Palermo para invertir.'},{direction:'outbound',content:'¿Querés que revisemos opciones en esa zona?'},{direction:'inbound',content:'Y en Villa Crespo tienen algo?'}],await getMiaTrialConfig());
assert(result.reply.trim());assert.doesNotMatch(result.reply,/Para orientarte bien|No pude verificar ese dato|No pude consultar/);assert(result.memory.preferences.neighborhoods.some(n=>/villa crespo/i.test(n)),'Neighborhood change lost');
console.log('MIA_PROVIDER_RECOVERY_SMOKE',JSON.stringify({reply:result.reply,preferences:result.memory.preferences,clientWrites:0,sends:0}));
})().catch(e=>{console.error('MIA_PROVIDER_RECOVERY_SMOKE failed:',e.message);process.exitCode=1;});
