const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

async function runCallback(overrides = {}) {
  const saved = [], calls = [];
  let configured = false;
  const module = { exports: {} };
  const modules = {
    'next/server': { NextResponse: { redirect: url => ({ url, cookies: { set() {} } }) } },
    'next-auth': { getServerSession: async () => ({ user: { role: 'admin', id: 'admin' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/meta-social': { getMetaSocialAppId: async () => 'crm', resetMetaSocialCredentials() {}, configureMetaSocialWebhook: async () => { configured = true; return { leadgenConfigured: true, messagesConfigured: false }; } },
    '@/lib/meta-app-config': { getMetaCrmAppSecret: () => 'crm-secret' },
    '@/lib/meta-social-store': { socialConnectionStore: async value => saved.push(value) },
  };
  const code = ts.transpileModule(fs.readFileSync('app/api/crm/meta/callback/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, URLSearchParams, AbortSignal, console, process: { env: { META_CRM_PAGE_ID: 'page' } }, require: name => modules[name], fetch: async url => {
    calls.push(new URL(url));
    const path = new URL(url).pathname;
    if (overrides[path]) return Response.json(overrides[path].body, { status: overrides[path].status || 200 });
    if (path.endsWith('/oauth/access_token')) return Response.json({ access_token: calls.length === 1 ? 'short' : 'long' });
    if (path.endsWith('/me/permissions')) return Response.json({ data: [{ permission: 'leads_retrieval', status: 'granted' }] });
    if (path.endsWith('/leadgen_forms')) return Response.json({ data: [{ id: 'form' }] });
    if (path.endsWith('/leads')) return Response.json({ data: [] });
    return Response.json({ id: 'page', access_token: 'page-token' });
  } });
  const result = await module.exports.GET({ nextUrl: new URL('https://barrerabrokers.com/api/crm/meta/callback?state=random.admin&code=code'), cookies: { get: () => ({ value: 'random.admin' }) } });
  return { result, saved, configured, calls };
}

test('CRM OAuth stores page and user token without Instagram and configures leads', async () => {
  const { result, saved, configured, calls } = await runCallback();
  assert.ok(result.url.endsWith('metaConnection=connected'));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].appId, 'crm');
  assert.equal(saved[0].token, 'page-token');
  assert.equal(saved[0].userToken, 'long');
  assert.equal(configured, true);
  assert.equal(calls[0].searchParams.get('client_secret'), 'crm-secret');
  assert.ok(calls.every(url => !url.pathname.includes('/conversations')));
});

test('CRM OAuth keeps the previous connection when lead permission was declined', async () => {
  const { result, saved, configured } = await runCallback({ '/v26.0/me/permissions': { body: { data: [{ permission: 'leads_retrieval', status: 'declined' }] } } });
  assert.ok(result.url.endsWith('metaConnection=leads_denied'));
  assert.equal(saved.length, 0);
  assert.equal(configured, false);
});

test('CRM OAuth keeps the previous connection when page forms are inaccessible', async () => {
  const { result, saved, configured } = await runCallback({ '/v26.0/page/leadgen_forms': { status: 403, body: { error: { code: 200 } } } });
  assert.ok(result.url.endsWith('metaConnection=leads_denied'));
  assert.equal(saved.length, 0);
  assert.equal(configured, false);
});

test('CRM OAuth keeps the previous connection when forms can be listed but leads cannot be read', async () => {
  const { result, saved, configured } = await runCallback({ '/v26.0/form/leads': { status: 403, body: { error: { code: 200 } } } });
  assert.ok(result.url.endsWith('metaConnection=leads_denied'));
  assert.equal(saved.length, 0);
  assert.equal(configured, false);
});

test('CRM OAuth supports an authorized page with no forms yet', async () => {
  const { result, saved } = await runCallback({ '/v26.0/page/leadgen_forms': { body: { data: [] } } });
  assert.ok(result.url.endsWith('metaConnection=connected'));
  assert.equal(saved.length, 1);
});
