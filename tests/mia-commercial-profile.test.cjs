const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:id=>mocks[id]||(id.startsWith('@/')?load(id.slice(2)+'.ts',mocks):require(id)),console,Date,process,Set,Map});return module.exports;}
const api=load('lib/mia-commercial-profile.ts',{'@/lib/database-pool':{}});
const search=load('lib/mia-agent-search.ts');
test('interest uses explicit customer actions and never silence, greetings, hypothetical visits or refusals',()=>{
 for(const text of ['Hola','Gracias','Sí','No quiero agendar una reunión','Si quisiera reservar, ¿qué necesito?','No me interesa Belgrano, busco Núñez'])assert.notEqual(api.miaInterest(text)?.temperature,'caliente');
 assert.equal(api.miaInterest('Hola'),null);
 assert.equal(api.miaInterest('Quisiera agendar una reunión con Pablo').temperature,'caliente');
 assert.equal(api.miaInterest('Enviame una propuesta').temperature,'caliente');
 assert.equal(api.miaInterest('Busco dos ambientes en Núñez').temperature,'tibio');
 assert.equal(api.miaInterest('Solo estoy mirando').temperature,'frio');
 assert.notEqual(api.miaInterest('No me interesa Belgrano, busco Núñez')?.temperature,'frio');
 assert.equal(api.miaInterest('Hola\n[Origen del anuncio]\nQuiero reservar'),null);
});
function transaction(row){const writes=[];const tx=async(strings,...values)=>{const query=strings.join('?');if(query.includes('SELECT l.id'))return row?[row]:[];if(query.includes('UPDATE'))writes.push({query,values});return [];};tx.json=x=>x;return {tx,writes};}
test('commercial profile writes notes and color, preserving Nuevo and the assigned owner',async()=>{
 const h=transaction({id:'lead',temperature:'',notes:'Nota humana',meta_properties:{},content:'Busco dos ambientes en Núñez'});
 const p=search.agentPreferencesSchema.parse({rooms:[2],neighborhoods:['Núñez'],purpose:'living',down:{amount:50000,currency:'USD'}});
 await api.persistMiaCommercialProfile(h.tx,'chat','in',p);
 assert.equal(h.writes.length,1);assert.equal(h.writes[0].values[0],'tibio');
 assert.match(h.writes[0].values[1],/Objetivo: Vivienda/);assert.match(h.writes[0].values[1],/Anticipo máximo: USD 50.000/);
 assert.match(h.writes[0].query,/concat_ws/);assert.doesNotMatch(h.writes[0].query,/\bstatus\s*=|assigned_agent_id\s*=/);
});
test('MIA respects a human color, updates its own color and does not cool a hot lead on a routine question',async()=>{
 for(const [temperature,previous,content,expected] of [
 ['frio',undefined,'Quiero agendar una reunión','frio'],
 ['tibio',{appliedTemperature:'tibio'},'Quiero agendar una reunión','caliente'],
 ['caliente',{appliedTemperature:'caliente',reason:'Pidió una reunión'},'¿Qué anticipo tiene?','caliente'],
 ['caliente',{appliedTemperature:'caliente'},'Solo estoy mirando','frio'],
 ]){
  const h=transaction({id:'lead',temperature,notes:'',meta_properties:{mia_commercial_profile_v1:previous},content});
  await api.persistMiaCommercialProfile(h.tx,'chat','in');assert.equal(h.writes[0]?.values[0],expected);
 }
});
test('replayed identical qualification does not append duplicate notes',async()=>{
 const interest=api.miaInterest('Busco dos ambientes');
 const h=transaction({id:'lead',temperature:'tibio',meta_properties:{mia_commercial_profile_v1:{appliedTemperature:'tibio',temperature:'tibio',summary:'',reason:interest.reason}},content:'Busco dos ambientes'});
 await api.persistMiaCommercialProfile(h.tx,'chat','in');assert.equal(h.writes.length,0);
});
test('an obsolete agenda turn cannot change the lead',async()=>{
 let updates=0;const tx=async(strings)=>{const q=strings.join('');if(q.includes('SELECT m.id'))return [{id:'newer'}];if(q.includes('SELECT l.id')||q.includes('UPDATE'))updates++;return [];};tx.json=x=>x;
 const check=load('lib/mia-commercial-profile.ts',{'@/lib/database-pool':{getSharedDatabase:()=>({begin:fn=>fn(tx)}),releaseSharedDatabase:async()=>{}}});
 await check.recordMiaMeetingInterest('chat','older');assert.equal(updates,0);
});
test('resetting preferences clears the MIA summary without erasing human notes or changing temperature',async()=>{
 const h=transaction({id:'lead',temperature:'tibio',notes:'Nota humana',meta_properties:{mia_commercial_profile_v1:{appliedTemperature:'tibio',temperature:'tibio',summary:'Zonas: Núñez',reason:'Búsqueda concreta'}},content:'Nueva búsqueda'});
 await api.persistMiaCommercialProfile(h.tx,'chat','in',search.agentPreferencesSchema.parse({}));
 assert.equal(h.writes.length,1);assert.equal(h.writes[0].values[0],'tibio');assert.equal(h.writes[0].values[2].mia_commercial_profile_v1.summary,'');
});
test('private sandbox saves memory without modifying the commercial lead profile',async()=>{
 let profileCalls=0;const tx=async(strings)=>strings.join('').includes('SELECT m.id')?[{id:'current'}]:[];
 const memory=load('lib/mia-agent-memory.ts',{'@/lib/mia-commercial-profile':{persistMiaCommercialProfile:async()=>profileCalls++},'@/lib/mia-agent-search':search,'@/lib/database-pool':{getSharedDatabase:()=>({begin:fn=>fn(tx)}),releaseSharedDatabase:async()=>{}}});
 await memory.writeAgentMemory('chat','scope','current',search.emptyAgentMemory(),false);assert.equal(profileCalls,0);
 await memory.writeAgentMemory('chat','scope','current',search.emptyAgentMemory(),true);assert.equal(profileCalls,1);
});
