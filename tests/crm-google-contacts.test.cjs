const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const vm = require('node:vm');
const fs = require('node:fs');
const code = ts.transpileModule(fs.readFileSync('lib/crm-google-contacts.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const marker = 'Barrera Brokers CRM lead';

function fixture({ agentEmail = 'pablo@barrerabrokers.com', accountOverride = {}, saved = {}, connections = [], failCreate = false, reassigned = false } = {}) {
  const calls = [], updates = [];
  const state = { id: 'lead-1', resource_name: null, synced_version: null, create_pending: false, ...saved };
  const sql = async (strings, ...values) => {
    const query = strings.join('?');
    if (query.includes('pg_try_advisory_lock')) return [{ acquired: true }];
    if (query.includes('SELECT id FROM agents')) return [{ id: values[0] }];
    if (query.includes('SELECT l.id,s.resource_name')) return values[0] === agentEmail ? [{ ...state }] : [];
    if (query.includes('SELECT id,first_name')) return reassigned ? [] : [{ id: state.id, first_name: 'Maria', last_name: 'Fernandez', email: 'maria@example.test', phone: '91112345678', country_code: '+54', updated_at: '2026-10-01' }];
    updates.push({ query, values });
    if (query.includes('SET create_pending=TRUE')) state.create_pending = true;
    if (query.includes('SET resource_name=')) { state.resource_name = values[0]; state.synced_version = values[1]; state.create_pending = false; }
    return [];
  };
  sql.end = async () => {};
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, Date, String, Error, JSON, Object, URLSearchParams, AbortSignal,
    process: { env: { DATABASE_URL: 'test' } },
    require: name => name === '@/lib/database-worker-lease' ? {acquireWorkerLease:async()=>"lease",releaseWorkerLease:async()=>{}} : name === 'postgres' ? { default: () => sql } : name === '@/lib/db' ? {
      getCrmEmailAccountWithSecret: async email => ({ provider: 'google-oauth', email, googleScopes: 'https://www.googleapis.com/auth/contacts', ...accountOverride }),
    } : name === '@/lib/google-oauth' ? { getAccessTokenForGoogleAccount: async ({ account }) => account.email } : name === '@/lib/phone-countries' ? {
      splitInternationalPhone: (phone, countryCode) => ({ phone: phone || '', countryCode }),
    } : require(name),
    fetch: async (url, options) => {
      calls.push({ url, ...options, body: options.body && JSON.parse(options.body) });
      if (url.includes(':createContact') && failCreate) throw new Error('Timeout');
      const data = url.includes('/connections') ? { connections } : { resourceName: 'people/c1', metadata: { sources: [{ type: 'CONTACT', etag: 'v1' }] } };
      return { ok: true, status: 200, json: async () => data };
    },
  });
  return { api: module.exports, calls, updates, state };
}

test('exports assigned leads only through each matching allowed Google identity', async () => {
  const creates = [];
  for (const agentEmail of ['pablo@barrerabrokers.com', 'martina@barrerabrokers.com']) {
    const { api, calls } = fixture({ agentEmail });
    const result = await api.processCrmGoogleContacts();
    assert.equal(result.failed, 0);
    creates.push(...calls.filter(c => c.url.includes(':createContact')));
  }
  assert.equal(creates.length, 2);
  assert.deepEqual(creates.map(c => c.headers.Authorization), ['Bearer pablo@barrerabrokers.com', 'Bearer martina@barrerabrokers.com']);
  assert.equal(creates[0].body.phoneNumbers[0].value, '+5491112345678');
  assert.equal(creates[0].body.userDefined[0].value, 'lead-1');
});

test('wrong Google identity or missing permission cannot export contacts', async () => {
  for (const accountOverride of [{ email: 'other@example.test' }, { googleScopes: 'openid' }, { provider: 'smtp' }]) {
    const { api, calls } = fixture({ accountOverride });
    const result = await api.processCrmGoogleContacts();
    assert.equal(calls.length, 0);
    assert.equal(result.failed, 2);
  }
});

test('assignment changed before write skips the lead', async () => {
  const { api, calls } = fixture({ reassigned: true });
  await api.processCrmGoogleContacts();
  assert.equal(calls.filter(c => c.method !== 'GET').length, 0);
});

test('reconciles an uncertain creation by CRM marker and preserves other custom fields', async () => {
  const { api, calls } = fixture({ saved: { create_pending: true }, connections: [{ resourceName: 'people/c1', metadata: { sources: [{ etag: 'v1' }] }, userDefined: [{ key: marker, value: 'lead-1' }, { key: 'Personal', value: 'Keep' }] }] });
  await api.processCrmGoogleContacts();
  assert.equal(calls.filter(c => c.url.includes(':createContact')).length, 0);
  const update = calls.find(c => c.method === 'PATCH');
  assert.equal(update.body.metadata.sources[0].etag, 'v1');
  assert.equal(update.body.userDefined[0].value, 'Keep');
});

test('a contact with the same name but no CRM marker is not overwritten', async () => {
  const { api, calls } = fixture({ connections: [{ resourceName: 'people/personal', names: [{ givenName: 'Maria' }] }] });
  await api.processCrmGoogleContacts();
  assert.equal(calls.filter(c => c.method === 'PATCH').length, 0);
});

test('a timed out creation remains pending and is not blindly duplicated', async () => {
  const { api, calls, state } = fixture({ failCreate: true });
  await api.processCrmGoogleContacts();
  assert.equal(state.create_pending, true);
  const first = calls.filter(c => c.url.includes(':createContact')).length;
  await api.processCrmGoogleContacts();
  assert.equal(calls.filter(c => c.url.includes(':createContact')).length, first);
});

test('unchanged CRM payload is not rewritten on Google', async () => {
  const { api, calls, state } = fixture();
  await api.processCrmGoogleContacts();
  assert.ok(state.synced_version);
  const first = calls.filter(c => c.method !== 'GET').length;
  await api.processCrmGoogleContacts();
  assert.equal(calls.filter(c => c.method !== 'GET').length, first);
});
