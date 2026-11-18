const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(id, ...args) {
  return resolve.call(this, id.startsWith('@/') ? path.resolve(id.slice(2)) : id, ...args);
};
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, esModuleInterop:true}
}).outputText, file);
const {updateBaMemory} = require('../mia/lib/ba-memory.ts');
const {baCatalogReply} = require('../mia/lib/ba-catalog-replies.ts');

test('keeps needs across turns and ranks the whole neighborhood with no repeated units', () => {
  const first = updateBaMemory({}, 'Busco 1 o 2 ambientes en Nuñez', 'Juan', false);
  const latest = 'Para vivir, anticipo USD 50.000 y cuota 2.500';
  const second = updateBaMemory(first, latest, 'Juan', false);
  assert.deepEqual(second.ambientes_busca, [1,2]);
  assert.equal(second.anticipo_objetivo, 50000);
  assert.equal(second.cuota_objetivo, 2500);
  const options = baCatalogReply(latest, [], second);
  assert.equal(options.shown.length, 2);
  assert.match(options.reply, /Lo más cercano/);
  const next = baCatalogReply('Mostrame otras alternativas', [], {...second, unidades_mostradas:options.shown});
  assert(next.shown.length);
  assert(next.shown.every(unit=>!options.shown.includes(unit)));
});

test('uses the selected project for the complete information request', () => {
  const memory = updateBaMemory({}, 'Me interesa Ugarte 1524', 'Juan', false);
  const result = baCatalogReply('Pasame info y brochure', [], memory);
  assert.match(result.reply, /Ugarte 1524/);
  assert.match(result.reply, /google.com\/maps/);
  assert(result.reply.split('\f').every(message=>message.split('\n').length<=3));
});

test('a fresh neighborhood search clears the selected project and uses the Palermo family', () => {
  const memory = updateBaMemory({proyecto_activo:'Manuel Ugarte 1524'}, 'Busco en Palermo', 'María', false);
  assert.equal(memory.proyecto_activo, undefined);
  assert.equal(memory.barrio_busca, 'Palermo');
  const result = baCatalogReply('Quiero ver los precios', [], memory);
  assert.equal(result.shown.length, 2);
  assert.doesNotMatch(result.reply, /Ugarte/);
});

test('keeps the search when the customer gives a name and another detail in the same reply', () => {
  const first = updateBaMemory({}, 'Hola, busco en Belgrano', '', false);
  const second = updateBaMemory(first, 'María, busco 2 ambientes para invertir', '', true);
  assert.equal(second.nombre, 'María');
  assert.equal(second.barrio_busca, 'Belgrano');
  assert.equal(second.para_que, 'invertir');
  assert.deepEqual(second.ambientes_busca, [2]);
});

test('gives all five Belgrano projects with master facts and verification notices', () => {
  const memory = updateBaMemory({}, 'Busco en Belgrano', 'María', false);
  const result = baCatalogReply('Sí, pasame todo', [], memory);
  assert.equal(result.reply.match(/Maps: /g).length, 5);
  assert.equal(result.reply.match(/agente te verifica la unidad puntual/g).length, 4);
  assert(result.reply.split('\f').every(message=>message.split('\n').length<=3));
});

test('an explicit price request for Dorrego gives project details without quoting a unit', () => {
  const memory = updateBaMemory({}, 'Dorrego Place', 'Sofía', false);
  const result = baCatalogReply('¿Cuánto cuesta?', [], memory);
  assert.match(result.reply, /Av\. Dorrego 1511/i);
  assert.match(result.reply, /El agente te verifica la unidad puntual/);
  assert.deepEqual(result.shown, []);
});

test('Hollywood and only an advance are enough to rank one-room units', () => {
  const first = updateBaMemory({}, 'Busco en Palermo', 'Sofía', false);
  const second = updateBaMemory(first, '1 ambiente para invertir', 'Sofía', false);
  const latest = 'Hollywood, anticipo 45.000';
  const memory = updateBaMemory(second, latest, 'Sofía', false);
  const result = baCatalogReply(latest, [], memory);
  assert.equal(memory.barrio_busca, 'Palermo Hollywood');
  assert.equal(result.shown.length, 2);
  assert.match(result.reply, /Santa Fe 5022/);
});

test('Núñez offers one studio and one one-bedroom unit for a mixed search', () => {
  const memory = updateBaMemory({}, 'Busco 1 o 2 ambientes en Nuñez, anticipo 50.000 y cuota 2.500', 'Pablo', false);
  const result = baCatalogReply('Busco 1 o 2 ambientes', [], memory);
  assert.match(result.reply, /Unidad 101 · Studio/);
  assert.match(result.reply, /Unidad 203 · 2 AMB/);
  assert.match(result.reply, /Alpha Núñez/);
  assert.match(result.reply, /Larralde 2362/);
});

test('planos refers to the units shown in the conversation with Maps and actual brochure', () => {
  const result = baCatalogReply('planos?', [], {ultimas_unidades:['Manuel Ugarte 1524|101|37|134140','Manuel Ugarte 1576|503|30|135100']});
  assert.match(result.reply, /1524 · unidad 101 · plano 3/);
  assert.match(result.reply, /1576 · unidad 503 · plano 4/);
  assert.equal(result.reply.match(/Maps: /g).length, 2);
  assert.equal(result.reply.match(/Brochure: https:\/\//g).length, 2);
});

test('plan requests without prior options include both Ugarte brochures and one question', () => {
  const result=baCatalogReply('¿Tenés los planos?',[],{});
  assert.match(result.reply,/¿Ugarte 1524 o Ugarte 1576\?/);
  assert.match(result.reply,/1DfiH-SIbU5htztrfpiy-pCkZw8U2HePy/);
  assert.match(result.reply,/1yhd7DBosXjnYqEJccvHIRP5a-jc_Jmyf/);
  assert.equal(result.reply.split('\n').length,3);
});

test('a referenced project without verified individual plans gives a useful response', () => {
  const result=baCatalogReply('plano?',[],{proyecto_activo:'Vuelta de obligado 3928'});
  assert.match(result.reply,/agente te verifica el plano/);
  assert.match(result.reply,/Maps: https:/);
  assert.doesNotMatch(result.reply,/drive\/u\/2\/home/);
});

test('rewording the plan request answers again and flags the lead for attention', async () => {
  const seen = [];
  const memory = {nombre:'Pablo', ultimas_unidades:['Manuel Ugarte 1524|101|37|134140','Manuel Ugarte 1576|503|30|135100']};
  const tx = async (chunks, ...values) => {
    const sql = chunks.join('?');
    seen.push({sql, values});
    if (sql.includes('select * from public.mia_clients')) return [{id:'client',memoria_v4:memory,nombre:'Pablo'}];
    if (sql.includes('select * from public.mia_conversations')) return [{id:'conversation'}];
    if (sql.includes('returning id')) return [{id:'turn'}];
    return [];
  };
  tx.json = value => value;
  tx.savepoint = run => run(tx);
  const load = Module._load;
  Module._load = function(id, ...args) {
    if (id === '@/lib/database-pool') return {getSharedDatabase:()=>({begin:run=>run(tx)}),releaseSharedDatabase:async()=>{}};
    if (id === '@/lib/whatsapp-ai-provider') return {generateGroqCustomerReply:()=>assert.fail('El pedido de planos no requiere el modelo')};
    return load.call(this,id,...args);
  };
  let generate;
  try { ({generateMiaWhatsAppReply:generate} = require('../mia/lib/whatsapp-flow.ts')); }
  finally { Module._load = load; }
  const reply = await generate({phone:'5491100000000',contactName:'Pablo',leadId:'lead'},[
    {direction:'inbound',content:'planos?',whatsappMessageId:'first',status:'received'},
    {direction:'outbound',content:'Te reenvío los planos del brochure.\fManuel Ugarte 1524 · unidad 101 · plano 3 en el brochure.',status:'sent'},
    {direction:'inbound',content:'¿Tenés los planos?',whatsappMessageId:'second',status:'received'},
  ]);
  assert.match(reply,/Te reenvío los planos/);
  assert.match(reply,/unidad 101 · plano 3/);
  assert.match(reply,/unidad 503 · plano 4/);
  assert(seen.some(({sql})=>sql.includes('necesita_atencion_humana')));
  assert(seen.some(({sql,values})=>sql.includes('insert into public.mia_learnings') && values.includes('mia-unanswered:second')));
  assert(seen.some(({values})=>values.some(value=>value?.necesita_atencion_humana === true)));

  const contact = {phone:'5491100000000',contactName:'Pablo',leadId:'lead'};
  const direction = (direction, content, id) => ({direction,content,whatsappMessageId:id,status:'received'});
  const question = direction('inbound','¿Es al frente o contrafrente?','orientation');
  const clarify = await generate(contact,[question]);
  assert.match(clarify,/¿De la 101 o de la 503/);
  const pause = direction('inbound','Lo voy a pensar','pause');
  const first = await generate(contact,[question,direction('outbound',clarify),pause]);
  assert.match(first,/cuota, el anticipo o la ubicación/);
  const second = await generate(contact,[pause,direction('outbound',first),direction('inbound',pause.content,'pause-2')]);
  assert.match(second,/101 con la 503/);
  assert.notEqual(first,second);
  assert.doesNotMatch(first+second,/Te averiguo|Brochure:/i);
});
