const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../lib/crm-statuses.ts'), 'utf8');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, context);
const aliases = value => Array.from(context.exports.leadStatusFilterValues(value));

test('Nuevo includes imported and legacy values regardless of case/whitespace', () => {
  for (const value of ['NEW', 'Nuevo', 'nuevo', ' NUEVO ']) {
    assert.deepEqual(aliases(value).sort(), ['new', 'nuevo']);
  }
});
test('Other labels include their codes without combining different statuses', () => {
  assert.deepEqual(aliases('Abierto').sort(), ['abierto', 'open']);
  assert.deepEqual(aliases('Vendido'), ['vendido']);
  assert.deepEqual(aliases(' Personalizado '), ['personalizado']);
  assert(!aliases('En curso').includes('in_progress'));
});
