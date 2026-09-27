const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies, context = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, require: id => dependencies[id], process: { env: {} }, URL, AbortSignal, console, ...context,
  });
  return module.exports;
}

function fixture({ handler, importFailure = false, checkpointFailure = false, known = [], knownForms = ['777'], env = {}, seed = null } = {}) {
  let persisted = { id: 'job', status: 'queued', createdBy: null, since: '2026-08-24T00:00:00Z', until: '2026-09-24T00:00:00Z', createdAt: '2026-09-23T00:00:00Z', updatedAt: '2026-09-23T00:00:00Z', state: seed };
  let leased = false, failedCheckpoint = false;
  const imports = [], calls = [], records = [], processedLookups = [], completed = new Set(known);
  const deps = {
    '@/lib/meta-app-config': { getMetaCrmAppId: () => 'crm' },
    '@/lib/meta-lead-recovery-policy': load('lib/meta-lead-recovery-policy.ts', {}, { process: { env } }),
    '@/lib/meta-leads': {
      metaLeadConnection: async () => ({ token: 'PRIVATE-TOKEN', pageId: '123' }),
      getKnownMetaFormIds: async () => knownForms,
      createMetaImportContext: async () => ({ token: 'PRIVATE-TOKEN' }),
      findProcessedMetaLeadIds: async ids => { processedLookups.push(...ids); return new Set(ids.filter(id => completed.has(id))); },
      importMetaLeadgenId: async id => {
        if (importFailure) throw Error('private database details');
        imports.push(id); completed.add(id); return { created: true };
      },
    },
    '@/lib/meta-recovery-store': {
      getMetaRecovery: async () => structuredClone(persisted),
      claimMetaRecovery: async () => {
        if (leased || ['complete', 'partial', 'failed'].includes(persisted.status)) return null;
        leased = true; return { job: structuredClone(persisted), lease: 'lease' };
      },
      saveMetaRecovery: async (id, lease, state, status) => {
        if (checkpointFailure && imports.length && !failedCheckpoint) { failedCheckpoint = true; return false; }
        persisted = { ...persisted, state: structuredClone(state), status }; return true;
      },
      releaseMetaRecovery: async () => { leased = false; },
    },
    '@/lib/meta-sync-state': { recordMetaLeadsSync: async (summary, complete) => { records.push({ summary, complete }); } },
  };
  const module = load('lib/meta-recovery.ts', deps, {
    process: { env },
    fetch: async (input, options) => {
      const url = new URL(input); calls.push({ url, options });
      const result = handler && await handler(url);
      return result || Response.json({ data: [] });
    },
  });
  return { module, imports, calls, records, processedLookups, state: () => persisted };
}
const lead = id => ({ id: String(id), created_time: '2026-09-23T10:00:00Z' });
const EXTERNAL_FORM = '1473751244572870';
const recoveryForm = (id, overrides = {}) => ({ id, name: '', pages: 0, attempts: 0, done: false, ...overrides });
const recoveryState = (overrides = {}) => ({
  version: 1, appId: 'crm', pageId: '123', phase: 'scan', forms: [], leads: [], warnings: [],
  discovery: { pages: 1, attempts: 0 }, failures: 0, ...overrides,
});
async function finish(f) {
  let result;
  for (let i = 0; i < 10; i++) {
    result = await f.module.processMetaRecovery();
    if (['complete', 'partial', 'failed'].includes(result.status)) return result;
  }
  assert.fail('Recovery did not finish within ten ticks');
}

test('continues bounded imports in later ticks and stores no credential or Graph URL', async () => {
  const f = fixture({ handler: url => url.pathname.endsWith('/777/leads') ? Response.json({ data: Array.from({ length: 12 }, (_, i) => lead(i + 1)) }) : undefined });
  const first = await f.module.processMetaRecovery();
  assert.equal(first.status, 'running'); assert.ok(f.imports.length <= 5); assert.ok(first.pending > 0);
  for (let i = 0; i < 5 && f.state().status === 'running'; i++) await f.module.processMetaRecovery();
  assert.equal(f.state().status, 'complete'); assert.equal(f.imports.length, 12);
  assert.equal(new Set(f.imports).size, 12);
  assert.ok(!JSON.stringify(f.state()).includes('PRIVATE-TOKEN'));
  assert.ok(!JSON.stringify(f.state()).includes('graph.facebook'));
  assert.ok(f.calls.every(({ url, options }) => !url.searchParams.has('access_token') && options.headers.Authorization === 'Bearer PRIVATE-TOKEN'));
  assert.equal(f.records.at(-1).complete, true);
});

test('inaccessible discovery remains partial but known forms are recovered; private Meta message is not exposed', async () => {
  const f = fixture({ handler: url => {
    if (url.pathname.endsWith('/leadgen_forms')) return Response.json({ error: { code: 100, error_subcode: 33, message: 'secret diagnostics' } }, { status: 400 });
    if (url.pathname.endsWith('/777/leads')) return Response.json({ data: [lead(1)] });
  } });
  const result = await f.module.processMetaRecovery();
  assert.equal(result.status, 'partial'); assert.equal(result.created, 1);
  assert.ok(result.warnings.some(text => text.includes('100/33') && text.includes('123')));
  assert.ok(!JSON.stringify(result).includes('secret diagnostics'));
  assert.equal(f.records[0].complete, false);
});

test('does not reimport known submissions and deduplicates IDs returned by several forms', async () => {
  const f = fixture({ known: ['1'], handler: url => url.pathname.endsWith('/leads') ? Response.json({ data: [lead(1), lead(2)] }) : undefined });
  const result = await f.module.processMetaRecovery();
  assert.equal(result.unchanged, 1); assert.equal(result.created, 1); assert.equal(result.found, 2);
  assert.deepEqual(f.imports, ['2']);
});

test('checkpoints cursor, ignores next URL and applies source date window', async () => {
  const f = fixture({ handler: url => {
    if (!url.pathname.endsWith('/777/leads')) return;
    if (!url.searchParams.has('after')) return Response.json({ data: [{ ...lead(1), created_time: '2026-01-01T00:00:00Z' }], paging: { next: 'https://attacker.invalid/?access_token=PRIVATE-TOKEN', cursors: { after: 'cursor2' } } });
    return Response.json({ data: [lead(2), { ...lead(3), created_time: '2026-10-01T00:00:00Z' }] });
  } });
  await f.module.processMetaRecovery();
  assert.deepEqual(f.imports, ['2']);
  assert.ok(f.calls.every(({ url }) => url.hostname === 'graph.facebook.com'));
  assert.ok(f.calls.some(({ url }) => url.searchParams.get('after') === 'cursor2'));
});

test('an interrupted post-import checkpoint retries safely using persisted source identity', async () => {
  const f = fixture({ checkpointFailure: true, handler: url => url.pathname.endsWith('/777/leads') ? Response.json({ data: [lead(1)] }) : undefined });
  await f.module.processMetaRecovery();
  assert.equal(f.state().status, 'running'); assert.deepEqual(f.imports, ['1']);
  const next = await f.module.processMetaRecovery();
  assert.equal(next.status, 'complete'); assert.deepEqual(f.imports, ['1']); assert.equal(next.unchanged, 1);
});

test('retries a failed import across ticks at most three times and never marks the recovery complete', async () => {
  const f = fixture({ importFailure: true, handler: url => url.pathname.endsWith('/777/leads') ? Response.json({ data: [lead(1)] }) : undefined });
  await f.module.processMetaRecovery(); await f.module.processMetaRecovery();
  const result = await f.module.processMetaRecovery();
  assert.equal(result.status, 'partial'); assert.equal(result.errors, 1); assert.equal(result.pending, 0);
  assert.equal(f.state().state.leads[0].attempts, 3);
  assert.ok(!JSON.stringify(f.state()).includes('database details')); assert.equal(f.records[0].complete, false);
});

test('blocks resumption under a different CRM app or page', async () => {
  const f = fixture({ seed: { version: 1, appId: 'whatsapp', pageId: '123', phase: 'scan', forms: [], leads: [], warnings: [], discovery: { pages: 0, attempts: 0 }, failures: 0 } });
  const result = await f.module.processMetaRecovery();
  assert.equal(result.status, 'failed'); assert.equal(f.calls.length, 0); assert.equal(f.imports.length, 0);
});

test('excludes seeded default, configured and known forms while recovering other IDs', async () => {
  const excluded = ['858044513215666', EXTERNAL_FORM, '888'];
  const f = fixture({
    env: { META_LEAD_RECOVERY_EXCLUDED_FORM_IDS: ` ${excluded.join(', ')} `, META_LEAD_FORM_IDS: ` ${EXTERNAL_FORM}, 999 ` },
    knownForms: ['888', '777'],
    handler: url => url.pathname.endsWith('/777/leads') ? Response.json({ data: [lead(1)] }) : undefined,
  });
  const result = await finish(f);
  assert.equal(result.status, 'complete');
  assert.deepEqual(f.imports, ['1']);
  assert.deepEqual(f.state().state.forms.map(form => form.id).sort(), ['1108265682151952', '1456527069869122', '777', '999'].sort());
  assert.ok(excluded.every(id => f.calls.every(({ url }) => !url.pathname.endsWith(`/${id}/leads`))));
  assert.equal(result.forms, 4);
});

test('discovery cannot reintroduce an excluded form or exclude an unrelated similar ID', async () => {
  const similarId = `${EXTERNAL_FORM}0`;
  const f = fixture({
    env: { META_LEAD_RECOVERY_EXCLUDED_FORM_IDS: EXTERNAL_FORM },
    handler: url => {
      if (url.pathname.endsWith('/leadgen_forms')) return Response.json({ data: [{ id: EXTERNAL_FORM }, { id: similarId }, { id: '999' }] });
      if (url.pathname.endsWith(`/${EXTERNAL_FORM}/leads`)) return Response.json({ data: [lead(9)] });
      if (url.pathname.endsWith(`/${similarId}/leads`)) return Response.json({ data: [lead(2)] });
      if (url.pathname.endsWith('/999/leads')) return Response.json({ data: [lead(3)] });
    },
  });
  const result = await finish(f);
  assert.equal(result.status, 'complete');
  assert.deepEqual([...f.imports].sort(), ['2', '3']);
  assert.ok(!f.calls.some(({ url }) => url.pathname.endsWith(`/${EXTERNAL_FORM}/leads`)));
  assert.ok(!f.state().state.forms.some(form => form.id === EXTERNAL_FORM));
  assert.ok(f.state().state.forms.some(form => form.id === similarId));
});

test('resumed scans remove excluded work and only its exact form warnings', async () => {
  const pageWarning = `Formularios de la página 123: acceso pendiente para ${EXTERNAL_FORM}.`;
  const similarWarning = `Formulario ${EXTERNAL_FORM}0: otro formulario sigue sin acceso.`;
  const f = fixture({
    env: { META_LEAD_RECOVERY_EXCLUDED_FORM_IDS: EXTERNAL_FORM },
    seed: recoveryState({
      forms: [recoveryForm(EXTERNAL_FORM, { after: 'old-cursor' }), recoveryForm('777')],
      leads: [{ id: '9', formId: EXTERNAL_FORM, attempts: 2 }, { id: '8', formId: '777', attempts: 0 }],
      warnings: [`Formulario ${EXTERNAL_FORM}: fallo antiguo.`, pageWarning, similarWarning],
    }),
    handler: url => url.pathname.endsWith('/leads') ? Response.json({ data: [lead(2)] }) : undefined,
  });
  const result = await finish(f);
  assert.equal(result.status, 'partial');
  assert.deepEqual(f.imports, ['8', '2']);
  assert.equal(f.calls.length, 1);
  assert.ok(f.calls[0].url.pathname.endsWith('/777/leads'));
  assert.ok(!f.processedLookups.includes('9'));
  assert.ok(!f.state().state.forms.some(form => form.id === EXTERNAL_FORM));
  assert.ok(!f.state().state.leads.some(item => item.formId === EXTERNAL_FORM && !item.outcome));
  assert.deepEqual(Array.from(result.warnings), [pageWarning, similarWarning]);
  assert.equal(f.records.at(-1).complete, false);
});

test('resumed imports never look up or import excluded pending leads and still deduplicate others', async () => {
  const f = fixture({
    env: { META_LEAD_RECOVERY_EXCLUDED_FORM_IDS: EXTERNAL_FORM },
    known: ['3'],
    seed: recoveryState({
      phase: 'import', forms: [recoveryForm(EXTERNAL_FORM, { done: true }), recoveryForm('777', { done: true })],
      leads: [{ id: '9', formId: EXTERNAL_FORM, attempts: 2 }, { id: '2', formId: '777', attempts: 0 }, { id: '3', formId: '777', attempts: 0 }],
      warnings: [`Formulario ${EXTERNAL_FORM}: sin acceso.`],
    }),
  });
  const result = await finish(f);
  assert.equal(result.status, 'complete');
  assert.deepEqual(f.imports, ['2']);
  assert.equal(f.calls.length, 0);
  assert.ok(!f.processedLookups.includes('9'));
  assert.equal(result.created, 1); assert.equal(result.unchanged, 1); assert.equal(result.pending, 0);
  assert.equal(result.errors, 0); assert.equal(result.warnings.length, 0);
});

test('an already queued job with only excluded pending work can finish without imports', async () => {
  const f = fixture({
    env: { META_LEAD_RECOVERY_EXCLUDED_FORM_IDS: EXTERNAL_FORM },
    seed: recoveryState({
      phase: 'import', forms: [recoveryForm(EXTERNAL_FORM, { done: true, error: 'Sin acceso' })],
      leads: [{ id: '9', formId: EXTERNAL_FORM, attempts: 2 }],
      warnings: [`Formulario ${EXTERNAL_FORM}: Sin acceso`],
    }),
  });
  const result = await finish(f);
  assert.equal(result.status, 'complete');
  assert.equal(f.imports.length, 0); assert.equal(f.calls.length, 0); assert.equal(f.processedLookups.length, 0);
  assert.equal(result.pending, 0); assert.equal(result.warnings.length, 0);
});

test('production routes enqueue only; the authenticated cron owns processing', () => {
  const route = fs.readFileSync('app/api/crm/meta/backfill/route.ts', 'utf8');
  assert.match(route, /enqueueMetaRecovery/); assert.doesNotMatch(route, /processMetaRecovery\(/);
  assert.match(route, /session\.user\.role !== "admin"/); assert.match(route, /status: 202/);
  const cron = fs.readFileSync('app/api/cron/meta-leads/route.ts', 'utf8');
  assert.match(cron, /authorization !== `Bearer \$\{cronSecret\}`/); assert.match(cron, /processMetaRecovery\(/);
});
