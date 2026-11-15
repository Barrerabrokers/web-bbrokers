const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
test('history never opens a database for agents, marketing or missing roles',async()=>{
 let connections=0,queries=0,released=0;
 const db={getSharedDatabase(){connections++;return async()=>{queries++;return[{owner_name:'Agente',actor_name:'Administrador'}]}},releaseSharedDatabase:async()=>{released++}};
 const box={exports:{},require:()=>db};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/crm-owner-history.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,box);
 for(const role of ['agent','marketing',undefined,null,''])assert.equal((await box.exports.getCrmOwnerHistory('id',role)).length,0);
 assert.equal(connections,0);assert.equal(queries,0);
 assert.equal((await box.exports.getCrmOwnerHistory('id','admin')).length,1);assert.equal(connections,1);assert.equal(released,1);
});
