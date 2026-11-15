const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, deps = {}, globals = {}) {
 const module = { exports: {} };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports, require: id => deps[id] || require(id), process: { env: { GROQ_API_KEY: 'test-key' } }, File, FormData, AbortSignal, ...globals });
 return module.exports;
}
const audio = load('lib/crm-audio.ts');
const leadId = '117d5a8e-cf25-491b-9915-96040eb1c18c';
const session = { user: { id: 'agent', role: 'agent' } };
function setup({ user = session, lead = { id: leadId }, response = { text: 'Busca dos ambientes. Coordinar visita.' }, status = 200, fail = false, env } = {}) {
 const calls = [];
 const route = load('app/api/crm/transcribe/route.ts', {
  'next/server': { NextResponse: { json: (data, options) => Response.json(data, options) } },
  'next-auth': { getServerSession: async () => user },
  '@/lib/auth': { authOptions: {} },
  '@/lib/db': { getCrmLeadById: async (id, scope) => { calls.push({ id, scope }); return lead; } },
  '@/lib/roles': { canManageListings: role => ['admin','agent','marketing'].includes(role), canViewAllCrmContacts: role => role === 'admin' },
  '@/lib/crm-audio': audio,
 }, { ...(env ? { process: { env } } : {}), fetch: async (url, options) => { calls.push({ url, options }); if (fail) throw Error('private provider error'); return Response.json(response, { status }); } });
 return { ...route, calls };
}
function request(file = new File(['audio'], 'nota.m4a', { type: 'audio/mp4' }), id = leadId) {
 const data = new FormData(); data.set('leadId', id); data.set('audio', file);
 return new Request('https://example.test/api/crm/transcribe', { method: 'POST', body: data });
}
test('validates empty, unsupported and oversized files; accepts mobile and desktop formats', () => {
 for (const name of ['nota.M4A','voz.webm','voz.ogg','voz.mp3','voz.wav','voz.flac']) assert.equal(audio.validateCrmAudio({ name, size: 100 }), null);
 for (const file of [{name:'nota.m4a',size:0},{name:'nota.exe',size:100},{name:'nota.mp3',size:4000001}]) assert.ok(audio.validateCrmAudio(file));
 assert.equal(audio.appendTranscript('Nota existente\n', ' Texto nuevo '), 'Nota existente\n\nTexto nuevo');
 assert.equal(audio.appendTranscript('', ' Texto nuevo '), 'Texto nuevo');
});
test('rejects anonymous users and other agents contacts before invoking provider', async () => {
 for (const options of [{user:null},{lead:null},{user:{user:{id:'viewer',role:'visitor'}}}]) {
  const route=setup(options); const res=await route.POST(request()); assert.equal(res.status,403); assert.equal(route.calls.filter(c=>c.url).length,0);
 }
});
test('rejects bad IDs, file type and size before any paid transcription', async () => {
 for (const req of [request(undefined,'invalid'),request(new File(['a'],'bad.exe')),request(new File([new Uint8Array(4000001)],'large.mp3'))]) {
  const route=setup();const res=await route.POST(req);assert.ok([400,413].includes(res.status));assert.equal(route.calls.filter(c=>c.url).length,0);
 }
});
test('transcribes authorized contact through multipart; returns text only without storing activity', async () => {
 const route=setup();const res=await route.POST(request());assert.equal(res.status,200);assert.equal((await res.json()).text,'Busca dos ambientes. Coordinar visita.');
 const call=route.calls.find(c=>c.url);assert.equal(call.options.body.get('model'),'whisper-large-v3');assert.equal(call.options.body.get('file').name,'nota.m4a');
 assert.equal(route.calls[0].scope.includeAll,false);assert.equal(res.headers.get('cache-control'),'no-store');
});
test('provider quota, silence, missing credentials and timeouts produce safe retry errors', async () => {
 for (const [options, expected] of [[{status:429},429],[{response:{text:'  '}},422],[{env:{}},503],[{fail:true},504],[{status:500,response:{secret:'private'}},502]]) {
  const res=await setup(options).POST(request());assert.equal(res.status,expected);const body=await res.json();assert.ok(body.error);assert.ok(!JSON.stringify(body).includes('private'));
 }
});
