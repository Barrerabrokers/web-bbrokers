const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const repo = require('node:path').resolve(__dirname, '..');
const dep = createRequire(repo + '/package.json');
const ts = dep('typescript');
const source = fs.readFileSync(repo + '/lib/meta-recovery-store.ts', 'utf8');

function fixture(handler = () => []) {
  const calls = [], connections = [];
  let transactionId = 0;
  const factory = (_url, options) => {
    connections.push(options);
    const sql = async (parts, ...values) => {
      const text = parts.join('?').replace(/\s+/g, ' ').trim();
      const call = { text, values, transactionId }; calls.push(call);
      return handler(call, calls);
    };
    sql.begin = async cb => { transactionId++; return cb(sql); };
    sql.end = async () => {};
    sql.json = value => ({ json: value });
    return sql;
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, {
    module, exports: module.exports, process: { env: { DATABASE_URL: 'mock' } },
    require: id => id === 'postgres' ? factory : dep(id), Date,
  });
  return { api: module.exports, calls, connections };
}

function row(status = 'queued') {
  return {
    id: 'id', status, created_by: 'admin', since_at: new Date('2026-08-25T00:00:00Z'),
    until_at: new Date('2026-09-24T00:00:00Z'), created_at: new Date('2026-09-24T00:00:00Z'),
    updated_at: new Date('2026-09-24T00:00:00Z'), state: null,
  };
}

test('enqueue returns existing active job without INSERT and serializes transactionally', async () => {
  const f = fixture(({ text }) => text.startsWith('SELECT *') ? [row()] : []);
  const result = await f.api.enqueueMetaRecovery({ createdBy: 'different' });
  assert.equal(result.createdBy, 'admin');
  assert.equal(result.since, '2026-08-25T00:00:00.000Z');
  assert.ok(!f.calls.some(c => c.text.includes('INSERT INTO')));
  assert.equal(f.calls.filter(c => c.text.includes('pg_advisory_xact_lock')).length, 2);
  assert.ok(f.calls.some(c => c.text.includes('UNIQUE INDEX') && c.text.includes("WHERE status IN ('queued','running')")));
  assert.ok(f.calls.some(c => c.text.includes('ENABLE ROW LEVEL SECURITY')));
});

test('automatic enqueue returns recently created terminal job; manual enqueue ignores cooldown', async () => {
  const f = fixture(({ text }) => text.includes("status IN ('complete','partial','failed')") && text.startsWith('SELECT') ? [row('partial')] : text.includes('INSERT INTO') ? [row()] : []);
  assert.equal((await f.api.enqueueMetaRecovery({ automatic: true })).status, 'partial');
  assert.ok(!f.calls.some(c => c.text.includes('INSERT INTO')));
  assert.equal((await f.api.enqueueMetaRecovery()).status, 'queued');
  const insert = f.calls.find(c => c.text.includes('INSERT INTO'));
  assert.ok(insert.text.includes("until_at - interval '720 hours'"));
  assert.equal(f.calls.filter(c => c.text.includes('CREATE TABLE')).length, 1);
});

test('failed schema initialization resets promise and can retry', async () => {
  let fail = true;
  const f = fixture(({ text }) => {
    if (text.includes('CREATE TABLE') && fail) { fail = false; throw new Error('temporary'); }
    return [];
  });
  await assert.rejects(f.api.getMetaRecovery(), /temporary/);
  assert.equal(await f.api.getMetaRecovery(), null);
  assert.equal(f.calls.filter(c => c.text.includes('CREATE TABLE')).length, 2);
});

test('claim is one atomic SKIP LOCKED statement with ten-minute lease and active-only expiry predicate', async () => {
  const f = fixture(({ text }) => text.startsWith('WITH candidate') ? [row('running')] : []);
  const result = await f.api.claimMetaRecovery();
  assert.equal(result.job.status, 'running');
  assert.match(result.lease, /^[a-f0-9-]{36}$/);
  const claim = f.calls.find(c => c.text.startsWith('WITH candidate'));
  assert.match(claim.text, /FOR UPDATE SKIP LOCKED/);
  assert.match(claim.text, /lease_until <= clock_timestamp\(\)/);
  assert.match(claim.text, /interval '10 minutes'/);
});

test('save locks matching owner first and CAS checks expiry after lock; terminal clears lease', async () => {
  const f = fixture(({ text }) => text.startsWith('SELECT id') || text.startsWith('UPDATE public.crm_meta_recovery_jobs SET state') ? [{ id: 'id' }] : []);
  assert.equal(await f.api.saveMetaRecovery('id', 'lease', { progress: 2 }, 'complete'), true);
  const lock = f.calls.findIndex(c => c.text.startsWith('SELECT id'));
  const save = f.calls.findIndex(c => c.text.startsWith('UPDATE public.crm_meta_recovery_jobs SET state'));
  assert.ok(lock < save);
  assert.equal(f.calls[lock].transactionId, f.calls[save].transactionId);
  assert.match(f.calls[save].text, /lease_token = \?::uuid AND lease_until > clock_timestamp\(\)/);
  assert.equal(f.calls[save].values[2], true);
  assert.equal(f.calls[save].values[3], true);
});

test('stale owner and expired saves return false without claiming successful persistence', async () => {
  const stale = fixture();
  assert.equal(await stale.api.saveMetaRecovery('id', 'old', {}), false);
  assert.ok(!stale.calls.some(c => c.text.startsWith('UPDATE')));
  const expired = fixture(({ text }) => text.startsWith('SELECT id') ? [{ id: 'id' }] : []);
  assert.equal(await expired.api.saveMetaRecovery('id', 'old', {}), false);
});

test('release is lease-CAS only and cannot reset state or status', async () => {
  const f = fixture();
  await f.api.releaseMetaRecovery('id', 'lease');
  const release = f.calls.find(c => c.text.startsWith('UPDATE'));
  assert.match(release.text, /SET lease_token = NULL, lease_until = NULL/);
  assert.match(release.text, /WHERE id = \?::uuid AND lease_token = \?::uuid$/);
  assert.doesNotMatch(release.text, /SET state|SET status/);
});

test('invalid state/status rejected without database work and all operations use bounded timeouts', async () => {
  const f = fixture();
  await assert.rejects(f.api.saveMetaRecovery('id', 'lease', [], 'running'), /INVALID_STATE/);
  await assert.rejects(f.api.saveMetaRecovery('id', 'lease', {}, 'broken'), /INVALID_STATUS/);
  assert.equal(f.calls.length, 0);
  await f.api.getMetaRecovery();
  assert.ok(f.connections.every(c => c.max === 1 && c.prepare === false && c.connect_timeout === 8));
  for (const id of new Set(f.calls.map(c => c.transactionId))) {
    assert.ok(f.calls.some(c => c.transactionId === id && c.text === "SET LOCAL statement_timeout = '15s'"));
    assert.ok(f.calls.some(c => c.transactionId === id && c.text === "SET LOCAL lock_timeout = '3s'"));
  }
});
