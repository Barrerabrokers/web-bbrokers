const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
const exportsObject = {};
new Function('exports',ts.transpileModule(fs.readFileSync('mia/lib/reply-safety.ts','utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText)(exportsObject);
const {repeatsLastMessage,unverifiedMeetingClaim}=exportsObject;

test('blocks unavailable appointment promises and repeated closings', () => {
  assert.equal(unverifiedMeetingClaim('Mañana a las 11:00 te contacto para confirmar financiación.'),true);
  assert.equal(unverifiedMeetingClaim('Perfecto, la reunión ya está coordinada.'),true);
  assert.equal(unverifiedMeetingClaim('¿Querés que revisemos el presupuesto?'),false);
  const first='Perfecto, la reunión ya está coordinada. Seguimos por acá si te surge alguna consulta.';
  const near='Perfecto. La reunión ya está coordinada, seguimos por acá si surge alguna consulta.';
  assert.equal(repeatsLastMessage(first,near),true);
  assert.equal(repeatsLastMessage(first,'¿Cuánto querés destinar al anticipo?'),false);
});
