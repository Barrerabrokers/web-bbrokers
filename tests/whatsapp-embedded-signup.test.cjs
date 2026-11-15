const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks, globals = {}) {
 const module = { exports: {} };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { module, exports: module.exports, require: n => mocks[n] || require(n), process, URL, AbortSignal, ...globals });
 return module.exports;
}
function setup(phones, subscriptionOk = true) {
 const saved = [], requests = [];
 const api = load('app/api/crm/whatsapp/embedded-signup/route.ts', {
  'next/server': { NextResponse: { json: (body, opts) => ({ body, status: opts?.status || 200 }) } },
  'next-auth': { getServerSession: async () => ({ user: { role: 'admin' } }) },
  '@/lib/auth': { authOptions: {} },
  '@/lib/roles': { canViewAllCrmContacts: () => true },
  '@/lib/whatsapp-credentials': { saveWhatsAppChannelCredentials: async x => saved.push(x) },
  '@/lib/meta-app-config': { getWhatsAppAppId: () => 'app', getWhatsAppAppSecret: () => 'secret' },
  '@/lib/whatsapp-inbox-scope': { FIRST_CONTACT_WHATSAPP_NUMBER: '+54 11 6406-9668' }
 }, { fetch: async url => {
  requests.push(String(url));
  if (String(url).includes('oauth/access_token')) return { ok: true, json: async () => ({ access_token: 'token' }) };
  if (String(url).includes('/phone_numbers')) return { ok: true, json: async () => ({ data: phones }) };
  return { ok: subscriptionOk, json: async () => ({ error: { message: 'Subscription failed' } }) };
 } });
 return { api, saved, requests };
}
test('coexistence completes with waba_id only and resolves the official number', async () => {
 const { api, saved } = setup([{ id: '123', display_phone_number: '+54 9 11 6406-9668' }]);
 const response = await api.POST({ json: async () => ({ code: 'authorization', wabaId: '456' }) });
 assert.equal(response.status, 200); assert.equal(saved.length, 1); assert.equal(saved[0].phoneNumberId, '123');
});
test('rejects another number without subscribing or replacing credentials', async () => {
 const { api, saved, requests } = setup([{ id: '123', display_phone_number: '+54 9 11 1234-5678' }]);
 const response = await api.POST({ json: async () => ({ code: 'authorization', wabaId: '456' }) });
 assert.equal(response.status, 400); assert.equal(saved.length, 0); assert.equal(requests.some(x => x.includes('subscribed_apps')), false);
});
test('does not silently select a different phone from the completion event', async () => {
 const { api, saved } = setup([{ id: '123', display_phone_number: '+54 11 6406-9668' }]);
 const response = await api.POST({ json: async () => ({ code: 'authorization', wabaId: '456', phoneNumberId: '999' }) });
 assert.equal(response.status, 400); assert.equal(saved.length, 0);
});
test('does not report connected or save credentials when subscription fails', async () => {
 const { api, saved } = setup([{ id: '123', display_phone_number: '+54 11 6406-9668' }], false);
 const response = await api.POST({ json: async () => ({ code: 'authorization', wabaId: '456' }) });
 assert.equal(response.status, 502); assert.equal(saved.length, 0);
});
test('client accepts coexistence completion and preserves reported Meta errors', () => {
 const effects = [], refs = [], states = []; let receive;
 const react = { useState: initial => [initial, x => states.push(x)], useRef: initial => { const r = { current: initial }; refs.push(r); return r; }, useCallback: f => f, useEffect: f => effects.push(f) };
 const { WhatsAppEmbeddedSignup } = load('components/admin/whatsapp-embedded-signup.tsx', {
  react, 'react/jsx-runtime': { jsx: () => null, jsxs: () => null }, 'lucide-react': {}
 }, { window: { FB: { init() {} }, addEventListener: (_, f) => { receive = f; }, removeEventListener() {} } });
 WhatsAppEmbeddedSignup({}); effects[0]();
 receive({ origin: 'https://www.facebook.com', data: JSON.stringify({ type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING', data: { waba_id: '456' } }) });
 assert.equal(refs[0].current.wabaId, '456'); assert.equal(states.includes('finishing'), true);
 receive({ origin: 'https://www.facebook.com', data: { type: 'WA_EMBEDDED_SIGNUP', event: 'CANCEL', data: { error_message: 'Business invalid', error_code: '1690130', session_id: 'session' } } });
 assert.equal(states.includes('error'), true); assert.equal(states.some(x => typeof x === 'string' && x.includes('1690130') && x.includes('session')), true);
});
