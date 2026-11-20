const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/alpha-belgrano-catalog.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exportsObject, URL });
const { parseAlphaCsv, alphaPlan, alphaPlanNote, alphaShareText } = exportsObject;
const csv = fs.readFileSync('data/alpha-place-belgrano-prices.csv', 'utf8');

test('the actual multiline CSV and Argentine prices produce the six available units', () => {
  const catalog = parseAlphaCsv(csv);
  assert.equal(catalog.units.length, 27);
  const available = catalog.units.filter(u => u.status === 'disponible');
  assert.equal(available.map(u => u.number).join(','), '201,501,503,601,603,701');
  assert.equal(available.reduce((sum, u) => sum + u.price, 0), 1225114);
  assert.equal(Math.min(...available.map(u => u.price)), 135100);
  assert.equal(catalog.date, '12-Nov-26');
  assert.equal(catalog.units.find(u => u.number === '503').installment, 3400);
});

test('changed availability and prices come from the source, never a fixed six-unit list', () => {
  const changed = csv.replace('201,1002,Disponible', '201,1002,Vendido').replace('135.100', '139.500');
  const catalog = parseAlphaCsv(changed);
  assert.equal(catalog.units.filter(u => u.status === 'disponible').length, 5);
  assert.equal(catalog.units.find(u => u.number === '503').price, 139500);
});

test('unknown source structure, status, malformed data, and duplicate units fail closed', () => {
  assert.throws(() => parseAlphaCsv('<html>Sign in</html>'));
  assert.throws(() => parseAlphaCsv(csv.replace('201,1002,Disponible', '201,1002,Desconocido')));
  assert.throws(() => parseAlphaCsv(csv.replace('227.629', 'no informado')));
  assert.throws(() => parseAlphaCsv(csv + '\n2º,2,201,1002,Vendido,2,STUDIO,Frente,47,6,53,-,-,-'));
});

test('plans are assigned only to verified units and the 701 discrepancy is retained', () => {
  const catalog = parseAlphaCsv(csv);
  const unit = catalog.units.find(u => u.number === '701');
  assert.equal(unit.total, 54);
  assert.equal(unit.balcony, 7);
  assert.match(alphaPlan(unit), /plano-2.webp$/);
  assert.match(alphaPlan(catalog.units.find(u => u.number === '503')), /plano-4.webp$/);
  assert.equal(alphaPlan({ ...unit, number: '999' }), undefined);
  assert.match(alphaPlanNote(unit), /53 m²/);
});

test('share messages contain the exact unit, financing, source date and public plan links', () => {
  const catalog = parseAlphaCsv(csv);
  const text = alphaShareText(catalog.units.find(u => u.number === '503'), catalog, 'https://barrerabrokers.com');
  assert.match(text, /Unidad 503/);
  assert.doesNotMatch(text, /135[.,]?100|Precio de lista/);
  assert.match(text, /24 cuotas de US\$ 3\.400/);
  assert.match(text, /unidad=503#unidades/);
  assert.match(text, /https:\/\/barrerabrokers.com\/developments\/alpha-place-belgrano\/plano-4.webp/);
  assert.match(text, /12-Nov-26/);
  assert.match(alphaShareText(catalog.units.find(u => u.number === '701'), { ...catalog, live: false }, 'https://barrerabrokers.com'), /última lista de referencia/);
});


test('public catalog serialization omits every final price but preserves financing', () => {
  const catalog = parseAlphaCsv(csv);
  const view = exportsObject.alphaCatalogForViewer(catalog, false);
  assert.equal(view.units.some(unit => Object.hasOwn(unit, 'price')), false);
  assert.equal(view.units.find(unit => unit.number === '503').downPayment, 53500);
  assert.equal(view.units.find(unit => unit.number === '503').installment, 3400);
  assert.equal(catalog.units.find(unit => unit.number === '503').price, 135100);
  const internal = exportsObject.alphaCatalogForViewer(catalog, true);
  assert.equal(internal.units.find(unit => unit.number === '503').price, 135100);
  assert.doesNotMatch(alphaShareText(internal.units.find(unit => unit.number === '503'), catalog, 'https://barrerabrokers.com'), /135[.,]?100/);
});
