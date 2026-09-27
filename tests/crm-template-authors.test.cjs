const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('lib/crm-template-filters.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exportsObject = {};
new Function('exports', compiled)(exportsObject);
const { templateMatchesAuthor, templateAuthors } = exportsObject;

test('mine filters by the logged-in agent and never includes unknown authors', () => {
  assert.equal(templateMatchesAuthor({createdBy:'pablo'}, 'mine', 'pablo'), true);
  assert.equal(templateMatchesAuthor({createdBy:'lucas'}, 'mine', 'pablo'), false);
  assert.equal(templateMatchesAuthor({}, 'mine', ''), false);
  assert.equal(templateMatchesAuthor({}, 'mine', 'pablo'), false);
});
test('all and specific agents remain available', () => {
  assert.equal(templateMatchesAuthor({}, 'all', 'pablo'), true);
  assert.equal(templateMatchesAuthor({createdBy:'lucas'}, 'lucas', 'pablo'), true);
  assert.equal(templateMatchesAuthor({createdBy:'pablo'}, 'lucas', 'pablo'), false);
  assert.deepEqual(templateAuthors([{createdBy:'p',createdByName:'Pablo'}, {createdBy:'l',createdByName:'Lucas'}, {createdBy:'p',createdByName:'Pablo'}, {}]), [{id:'l',name:'Lucas'},{id:'p',name:'Pablo'}]);
});
test('template manager starts on mine and lists that option first', () => {
  assert.match(fs.readFileSync('components/admin/crm-template-manager.tsx','utf8'), /\[authorFilter, setAuthorFilter\] = useState\("mine"\)/);
  const filter = fs.readFileSync('components/admin/crm-template-author-filter.tsx','utf8');
  assert.ok(filter.indexOf('value="mine"') < filter.indexOf('value="all"'));
});
