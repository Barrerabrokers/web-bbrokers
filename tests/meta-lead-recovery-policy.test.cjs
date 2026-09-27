const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function exclusions(env = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('lib/meta-lead-recovery-policy.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, process: { env } });
  return [...module.exports.getExcludedMetaRecoveryFormIds()];
}

test('recovery has no implicit exclusions when no forms are configured', () => {
  assert.deepEqual(exclusions(), []);
  assert.deepEqual(exclusions({ META_LEAD_RECOVERY_EXCLUDED_FORM_IDS: ' , ' }), []);
});

test('parses exact form IDs, trims whitespace and deduplicates without broad matching', () => {
  assert.deepEqual(exclusions({ META_LEAD_RECOVERY_EXCLUDED_FORM_IDS: ' 1473751244572870, 123,1473751244572870, ,bad,123/456,12.3,* ' }), ['1473751244572870', '123']);
  assert.ok(!exclusions({ META_LEAD_RECOVERY_EXCLUDED_FORM_IDS: '123' }).includes('1234'));
});
