const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
test('schema checks use a transaction lock and skip DDL when already current',async()=>{
 const queries=[];let begun=0;const tx=async strings=>{const q=strings.join('?');queries.push(q);return q.includes('AS clients')?[{clients:true,history:true,events:true,members:true,reply_index:true,history_columns:15}]:[];};tx.unsafe=async()=>{throw Error('unexpected DDL')};const sql={begin:async fn=>{begun++;return fn(tx)}};
 const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/crm-clients.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:id=>id.startsWith('@/')?{}:id==='postgres'?{}:require(id)});
 await Promise.all([module.exports.ensureClients(sql),module.exports.ensureClients(sql)]);assert.equal(begun,1);assert.match(queries[0],/pg_advisory_xact_lock/);assert.equal(queries.some(q=>q.includes('pg_advisory_unlock')),false);assert.equal(queries.length,2);
});
