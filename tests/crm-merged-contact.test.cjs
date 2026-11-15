const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync(require.resolve('../lib/db.ts'),'utf8'),ast=ts.createSourceFile('db.ts',source,ts.ScriptTarget.Latest,true);
const code=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='upsertCrmLeadFromHubSpot').getText(ast);
test('reimporting a merged HubSpot identity returns its survivor without inserting or overwriting it',async()=>{
 let calls=0;const survivor={id:'survivor',email:'retained@example.com'};
 const sql=async(strings,...values)=>{calls++;assert.ok(strings.join('').includes('meta_properties ?'));assert.equal(values[0],'crm_merged_hubspot:old-hubspot');return[survivor]};
 const box={exports:{},console,getPgConnection:()=>sql,releaseSharedDatabase:async()=>{},mapCrmLead:value=>value};vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,box);
 const result=await box.exports.upsertCrmLeadFromHubSpot({objectId:'old-hubspot',properties:{firstname:'Old name'}});assert.equal(result.lead,survivor);assert.equal(result.created,false);assert.equal(result.error,null);assert.equal(calls,1);
});
