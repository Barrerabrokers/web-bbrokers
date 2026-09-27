const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../lib/db.ts'), 'utf8');
const ast = ts.createSourceFile('db.ts', source, ts.ScriptTarget.Latest, true);
const selected = ast.statements.filter(n => ts.isFunctionDeclaration(n) && ['formatNamePart', 'upsertCrmLead'].includes(n.name?.text)).map(n => n.getText(ast)).join('\n');

test('Status updates accept nullable contact fields and preserve SQL NULL for missing email', async () => {
  for (const email of [null, undefined, '', '  ', ' TEST@EXAMPLE.COM ']) {
    let parameters;
    const sql = async (strings, ...values) => { parameters = values; return [{ id: values[0] }]; };
    sql.json = value => value;
    sql.end = async () => {};
    const context = { exports: {}, console, getPgConnection: () => sql, ensureMeetingLifecycle: async () => {}, mapCrmLead: row => row };
    vm.runInNewContext(ts.transpileModule(selected, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context);
    const result = await context.exports.upsertCrmLead({ id: 'contact', email, firstName: null, lastName: null, countryCode: null, phone: null, status: 'Contactado' });
    assert.equal(result.error, null);
    assert.equal(parameters[3], email?.trim() ? 'test@example.com' : null);
    assert.equal(parameters[6], 'Contactado');
  }
});
