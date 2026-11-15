const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}, globals = {}) {
  const box = { exports: {}, Error, console, process, ...globals, require: name => name in mocks ? mocks[name] : require(name) };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, box);
  return box.exports;
}
const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ids = Array.from({ length: 10 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);

test('bulk API returns successful IDs and blocked reasons; workflows run only for changed contacts', async () => {
  let automated = [];
  const changes = ids.slice(1).map(id => ({ lead: { id, status: 'Contactado' }, previousStatus: 'Nuevo' }));
  const failed = [{ id: ids[0], name: 'Contacto bloqueado', error: 'Registrá el resultado de la reunión.' }];
  const route = load('app/api/crm/leads/bulk/route.ts', {
    '@/lib/mia-sales-dispatch': { dispatchMiaAssignment: async () => assert.fail('No se debe asignar MIA al cambiar estados') },
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    'next-auth': { getServerSession: async () => ({ user: { id: actorId, role: 'admin' } }) },
    '@/lib/auth': {},
    '@/lib/db': { updateCrmLeadSelection: async () => ({ changes, failed }) },
    '@/lib/roles': { canManageListings: () => true, canViewAllCrmContacts: () => true },
    '@/lib/crm-statuses': { isCrmLeadStatus: status => status === 'Contactado' },
    '@/lib/crm-workflow-runner': { runLeadStatusWorkflows: async ({ lead }) => automated.push(lead.id) },
    '@/lib/meta-conversions': { isInterestedLeadStatus: () => false },
  });
  const result = await route.PATCH({ json: async () => ({ ids, status: 'Contactado' }), nextUrl: { origin: 'https://example.com' } });
  assert.equal(result.status, 200);
  assert.equal(result.body.updated, 9);
  assert.deepEqual(Array.from(result.body.updatedIds), ids.slice(1));
  assert.equal(result.body.failed[0].id, ids[0]);
  assert.deepEqual(automated, ids.slice(1));
});

test('database: meeting guard blocks one contact without undoing nine valid status changes', { skip: process.env.RUN_CRM_BULK_DB_TESTS !== '1' }, async () => {
  require('@next/env').loadEnvConfig(process.cwd());
  const postgres = require('postgres');
  const sql = postgres(process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL, { ssl: 'require', prepare: false, max: 1, onnotice: () => {} });
  try {
    await sql.begin(async tx => {
      // Temporary tables shadow the production tables only for this isolated connection.
      await tx.unsafe(`CREATE TEMP TABLE crm_leads (id UUID PRIMARY KEY, first_name TEXT, last_name TEXT, status TEXT, assigned_agent_id UUID, development_id UUID, updated_at TIMESTAMPTZ, blocked BOOLEAN DEFAULT false) ON COMMIT DROP;
        CREATE TEMP TABLE agents (id UUID PRIMARY KEY, name TEXT, phone TEXT, active BOOLEAN, role TEXT) ON COMMIT DROP;
        CREATE TEMP TABLE developments (id UUID PRIMARY KEY, name TEXT) ON COMMIT DROP;
        CREATE FUNCTION pg_temp.bulk_test_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.blocked AND NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Registrá el resultado de la reunión pendiente.'; END IF; RETURN NEW; END; $$;
        CREATE TRIGGER meeting_guard BEFORE UPDATE OF status ON crm_leads FOR EACH ROW EXECUTE FUNCTION pg_temp.bulk_test_guard();`);
      for (const id of ids) await tx`INSERT INTO crm_leads (id, first_name, status, assigned_agent_id, blocked) VALUES (${id},'Prueba','Nuevo',${actorId},${id === ids[0]})`;
      const source = fs.readFileSync('lib/db.ts', 'utf8').split('export async function updateCrmLeadSelection')[1].split('export async function syncExtensionWhatsAppMessages')[0];
      const box = { exports: {}, Error, Date, Set, getPgConnection: () => Object.assign(tx, { begin: callback => tx.savepoint(callback) }), ensureMeetingLifecycle: async () => {}, releaseSharedDatabase: async () => {}, mapCrmLead: row => row };
      vm.runInNewContext(ts.transpileModule('export async function updateCrmLeadSelection' + source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, box);
      const update = box.exports.updateCrmLeadSelection;
      const result = await update({ ids, status: 'Contactado', actorId, includeAll: true });
      assert.equal(result.changes.length, 9);
      assert.equal(result.failed.length, 1);
      assert.equal(result.failed[0].id, ids[0]);
      assert.match(result.failed[0].error, /reunión pendiente/);
      const rows = await tx`SELECT id,status FROM crm_leads ORDER BY id`;
      assert.equal(rows[0].status, 'Nuevo');
      assert(rows.slice(1).every(row => row.status === 'Contactado'));
      // Ownership validation still rejects the entire request before applying changes.
      await assert.rejects(update({ ids, status: 'No contesta', actorId: ids[0], includeAll: false }), /no te pertenece/);
      assert.equal((await tx`SELECT count(*)::int AS count FROM crm_leads WHERE status='No contesta'`)[0].count, 0);
      // Unrelated database errors must roll back successful rows, not masquerade as meeting guards.
      await tx.unsafe(`CREATE FUNCTION pg_temp.bulk_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status='Reflote' AND NEW.id='${ids[5]}'::uuid THEN RAISE EXCEPTION 'database failure' USING ERRCODE='23514'; END IF; RETURN NEW; END; $$;
        CREATE TRIGGER infrastructure_failure BEFORE UPDATE OF status ON crm_leads FOR EACH ROW EXECUTE FUNCTION pg_temp.bulk_test_failure();`);
      await assert.rejects(update({ ids, status: 'Reflote', actorId, includeAll: true }), /database failure/);
      assert.equal((await tx`SELECT count(*)::int AS count FROM crm_leads WHERE status='Reflote'`)[0].count, 0);
    });
  } finally { await sql.end(); }
});
