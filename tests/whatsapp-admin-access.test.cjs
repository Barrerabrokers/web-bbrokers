const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('inbox API handlers require administrator access before loading or sending data', () => {
  for (const route of ['messages', 'conversations']) {
    const source = read(`app/api/crm/whatsapp/${route}/route.ts`);
    const handlers = source.split(/export async function /).slice(1);
    assert.equal(handlers.length, 2);
    for (const handler of handlers) {
      assert.match(handler, /if \(!session \|\| !canViewAllCrmContacts\(session.user.role\)\)/);
      assert.match(handler, /status: 403/);
      assert.doesNotMatch(handler, /canManageListings/);
    }
  }
  assert.match(read('lib/roles.ts'), /function canViewAllCrmContacts[^]*?return role === "admin"/);
});

test('inbox page and navigation deny non-administrators', () => {
  const page = read('app/admin/crm/marketing/whatsapp/page.tsx');
  assert.ok(page.indexOf('if (!canViewAllCrmContacts') < page.indexOf('await Promise.all'));
  const nav = read('components/admin/crm-nav.tsx');
  assert.match(nav, /icon: Inbox,\s+administratorOnly: true/);
  assert.match(nav, /!item.administratorOnly \|\| session\?\.user\?\.role === "admin"/);
});
