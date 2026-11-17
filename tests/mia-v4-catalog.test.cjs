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
const {baCatalogReply} = require('../mia/lib/ba-opportunities.ts');

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
