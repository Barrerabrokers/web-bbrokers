const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const csv = fs.readFileSync('data/alpha-place-belgrano-prices.csv', 'utf8');
function evaluate(file, require, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require, URL, AbortSignal, process, ...globals });
  return exports;
}
const catalog = evaluate('lib/alpha-belgrano-catalog.ts', require);

test('server source requests the fixed CSV URL and returns the current list', async () => {
  let requested;
  const source = evaluate('lib/alpha-belgrano-source.ts', name => name === './alpha-belgrano-catalog' ? catalog : require(name), {
    fetch: async (url, options) => { requested = url; assert.equal(options.next.revalidate, 300); return { ok: true, text: async () => csv }; },
  });
  const result = await source.getAlphaBelgranoCatalog();
  assert.match(requested, /^https:\/\/docs.google.com\/spreadsheets\/d\/1INuGPpFYt9UcsDLke8h9sY5zFQ6gGcRluk7_rFIDh_8\/export\?format=csv&gid=876335053$/);
  assert.equal(result.live, true);
  assert.equal(result.units.find(unit => unit.number === '503').price, 135100);
});
