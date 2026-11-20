const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: name => dependencies[name] });
  return exports;
}
const policy = load('lib/development-price-visibility.ts', { './roles': load('lib/roles.ts') });
const development = { slug: 'alpha-place-belgrano', priceFrom: 135100, minPriceAvailable: 135100, priceListUrl: 'https://example.com/private-list', units: [{ id: '503', price: 135100, downPayment: 53500, installmentValue: 3400 }] };

test('anonymous and unrecognized roles cannot receive Alpha final prices', () => {
  for (const role of [undefined, null, '', 'customer', 'viewer']) {
    assert.equal(policy.canSeeDevelopmentPrices(development.slug, role), false);
    const view = policy.developmentForPriceViewer(development, role);
    assert.doesNotMatch(JSON.stringify(view), /135100|private-list/);
    assert.equal(view.units[0].downPayment, 53500);
    assert.equal(view.units[0].installmentValue, 3400);
  }
  assert.equal(development.units[0].price, 135100);
});

test('existing authorized agent roles retain complete prices', () => {
  for (const role of ['agent', 'admin', 'marketing']) {
    assert.equal(policy.canSeeDevelopmentPrices(development.slug, role), true);
    assert.equal(policy.developmentForPriceViewer(development, role), development);
    assert.equal(policy.unitForPriceViewer(development.units[0], development.slug, role).price, 135100);
  }
});

test('the Alpha-specific rule preserves other developments', () => {
  const other = { ...development, slug: 'other-project' };
  assert.equal(policy.developmentForPriceViewer(other), other);
});
