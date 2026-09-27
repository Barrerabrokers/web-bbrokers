const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, { env = {}, fetch, modules = {} } = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, process: { env }, fetch, URLSearchParams, AbortSignal, require: name => {
    if (!(name in modules)) throw Error(`Unexpected dependency: ${name}`);
    return modules[name];
  } });
  return module.exports;
}

test('dedicated credentials stay isolated between CRM and WhatsApp', () => {
  const m = load('lib/meta-app-config.ts', { env: { META_APP_SECRET: 'legacy', META_CRM_APP_SECRET: 'crm', WHATSAPP_APP_SECRET: 'wa' } });
  assert.equal(m.getMetaCrmAppId(), '1113448051007765');
  assert.equal(m.getWhatsAppAppId(), '1735228224390278');
  assert.equal(m.getMetaCrmAppSecret(), 'crm');
  assert.equal(m.getWhatsAppAppSecret(), 'wa');
  const isolated = load('lib/meta-app-config.ts', { env: { WHATSAPP_APP_SECRET: 'wa' } });
  assert.equal(isolated.getMetaCrmAppSecret(), undefined);
  const old = load('lib/meta-app-config.ts', { env: { META_APP_SECRET: 'legacy' } });
  assert.equal(old.getWhatsAppAppSecret(), 'legacy');
  assert.equal(old.getMetaCrmAppSecret(), 'legacy');
});

test('credential diagnostics never return the secret or token', async () => {
  const m = load('lib/meta-app-config.ts', { env: { META_CRM_APP_SECRET: 'private-secret' }, fetch: async () => Response.json({ error: { code: 190, message: 'private-secret' } }, { status: 400 }) });
  const result = await m.inspectMetaCrmAppConfiguration();
  assert.equal(result.valid, false);
  assert.equal(result.code, 190);
  assert.ok(!JSON.stringify(result).includes('private-secret'));
});

test('Lead Ads webhook can be configured with no Instagram or Messenger permissions', async () => {
  const calls = [];
  const m = load('lib/meta-lead-webhook.ts', {
    env: { META_VERIFY_TOKEN: 'verify' },
    modules: { '@/lib/meta-app-config': { getMetaCrmAppId: () => 'crm', getMetaCrmAppSecret: () => 'secret' }, '@/lib/meta-social-store': { socialConnectionStore: async () => ({ appId: 'crm', pageId: 'page', token: 'page-token' }) } },
    fetch: async (url, opts) => { calls.push({ url, opts }); return Response.json(opts.method === 'POST' ? { success: true } : { data: [] }); },
  });
  assert.equal((await m.configureMetaLeadWebhook()).leadgenConfigured, true);
  assert.equal(calls.length, 4);
  assert.ok(calls.every(c => !c.url.includes('instagram')));
  assert.equal(calls[1].opts.body.get('fields'), 'leadgen');
  assert.equal(calls[3].opts.body.get('subscribed_fields'), 'leadgen');
  assert.equal(calls[3].opts.headers.Authorization, 'Bearer page-token');
});

test('Lead Ads ignores a saved connection belonging to the WhatsApp app', async () => {
  const calls = [];
  const m = load('lib/meta-lead-webhook.ts', {
    env: { META_VERIFY_TOKEN: 'verify', META_CRM_PAGE_ID: 'crm-page', META_CRM_ACCESS_TOKEN: 'crm-token' },
    modules: { '@/lib/meta-app-config': { getMetaCrmAppId: () => 'crm', getMetaCrmAppSecret: () => 'secret' }, '@/lib/meta-social-store': { socialConnectionStore: async () => ({ appId: 'whatsapp', pageId: 'wrong-page', token: 'wrong-token' }) } },
    fetch: async (url, opts) => { calls.push({ url, opts }); return Response.json(opts.method === 'POST' ? { success: true } : { data: [] }); },
  });
  await m.configureMetaLeadWebhook();
  assert.ok(calls[3].url.includes('/crm-page/subscribed_apps'));
  assert.equal(calls[3].opts.headers.Authorization, 'Bearer crm-token');
});

test('Lead webhook preserves existing subscriptions and refuses another callback URL', async () => {
  const writes = [];
  const modules = { '@/lib/meta-app-config': { getMetaCrmAppId: () => 'crm', getMetaCrmAppSecret: () => 'secret' }, '@/lib/meta-social-store': { socialConnectionStore: async () => ({ appId: 'crm', pageId: 'page', token: 'token' }) } };
  const m = load('lib/meta-lead-webhook.ts', { env: { META_VERIFY_TOKEN: 'verify' }, modules, fetch: async (url, opts) => {
    if (opts.method === 'POST') { writes.push(opts.body); return Response.json({ success: true }); }
    return Response.json({ data: url.endsWith('/subscriptions') ? [{ object: 'page', callback_url: 'https://barrerabrokers.com/api/crm/meta/webhook', fields: [{ name: 'messages' }] }] : [{ id: 'crm', subscribed_fields: ['messages'] }] });
  } });
  await m.configureMetaLeadWebhook();
  assert.equal(writes[0].get('fields'), 'messages,leadgen');
  assert.equal(writes[1].get('subscribed_fields'), 'messages,leadgen');
  const other = load('lib/meta-lead-webhook.ts', { env: { META_VERIFY_TOKEN: 'verify' }, modules, fetch: async () => Response.json({ data: [{ object: 'page', callback_url: 'https://another.example/webhook' }] }) });
  await assert.rejects(other.configureMetaLeadWebhook(), /otra URL/);
});
