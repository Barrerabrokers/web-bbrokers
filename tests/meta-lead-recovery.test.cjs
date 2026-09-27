const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const crypto = require("node:crypto");
const ts = require("typescript");

function load(file, dependencies, context = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: id => Object.prototype.hasOwnProperty.call(dependencies, id) ? dependencies[id] : require(id),
    process: { env: {} }, console, Buffer, URL, AbortSignal, Error, ...context,
  });
  return module.exports;
}

function fixture({ saved = { appId: "crm-app", pageId: "saved-page", token: "page-token" }, env = {}, handler, existing = false, notificationFailure = false } = {}) {
  const calls = [], imports = [], records = [], effects = [];
  const module = load("lib/meta-leads.ts", {
    "@/lib/developments-db": { getDevelopments: async () => [] },
    "@/lib/db": {
      getAllAgents: async () => [{ id: "admin", email: "pablo@barrerabrokers.com", name: "Pablo", role: "admin" }],
      upsertCrmLeadByEmail: async (data, options) => {
        imports.push({ data, options });
        return { lead: { id: "contact" }, created: !existing, error: null };
      },
      createCrmActivity: async () => { effects.push("activity"); },
      notifyCrmCampaignRecontact: async () => { effects.push("notification"); return { error: notificationFailure ? "notification failed" : null }; },
    },
    "@/lib/phone-countries": { splitInternationalPhone: () => ({ countryCode: "+54", phone: "123" }) },
    "@/lib/meta-social-store": { socialConnectionStore: async () => saved },
    "@/lib/meta-app-config": { getMetaCrmAppId: () => "crm-app", getMetaCrmAppSecret: () => "crm-secret" },
    "@/lib/meta-lead-recovery-policy": load("lib/meta-lead-recovery-policy.ts", {}, { process: { env } }),
    "@/lib/meta-sync-state": {
      recordMetaLeadsSync: async (details, complete) => {
        records.push({ details, complete });
        return complete ? "2026-09-23T20:00:00.000Z" : "2026-09-22T20:00:00.000Z";
      },
    },
  }, {
    process: { env },
    fetch: async input => {
      const url = new URL(input); calls.push(url);
      const path = url.pathname.replace(/^\/v[^/]+\//, "");
      const custom = handler && await handler(path, url);
      if (custom) return custom;
      if (path.endsWith("/leadgen_forms") || path.endsWith("/leads")) return Response.json({ data: [] });
      if (path === "lead-1") return Response.json({
        id: "lead-1", form_id: "form-new", created_time: new Date().toISOString(),
        field_data: [{ name: "email", values: [" CLIENT@example.com "] }, { name: "full_name", values: ["Cliente Prueba"] }],
      });
      if (path === "form-new") return Response.json({ id: "form-new", name: "Formulario nuevo" });
      throw new Error("Unexpected mocked request: " + path);
    },
  });
  return { module, calls, imports, records, effects };
}

test("a recontact notification is persisted before the recovery completion marker", async () => {
  const f = fixture({ existing: true });
  await f.module.importMetaLeadgenId("lead-1");
  assert.deepEqual(f.effects, ["notification", "activity"]);
  const failed = fixture({ existing: true, notificationFailure: true });
  await assert.rejects(() => failed.module.importMetaLeadgenId("lead-1"), /avisar al propietario/);
  assert.deepEqual(failed.effects, ["notification"]);
});

test("uses saved CRM page for discovery without sending its Page token to me/accounts", async () => {
  const f = fixture({ handler: path => path === "saved-page/leadgen_forms" ? Response.json({ data: [{ id: "form-new" }] }) : undefined });
  const result = await f.module.backfillRecentMetaLeads();
  assert.equal(result.discoveredForms, 1);
  assert.equal(result.complete, true);
  assert.equal(f.records[0].complete, true);
  assert.ok(f.calls.some(url => url.pathname.endsWith("/saved-page/leadgen_forms")));
  assert.ok(f.calls.every(url => !url.pathname.endsWith("/me/accounts")));
  assert.ok(f.calls.every(url => url.searchParams.get("access_token") === "page-token"));
});

test("ignores a saved WhatsApp connection and uses dedicated CRM token and page", async () => {
  const f = fixture({
    saved: { appId: "whatsapp-app", pageId: "wrong-page", token: "wrong-token", userToken: "wrong-user" },
    env: { META_CRM_ACCESS_TOKEN: "crm-token", META_ACCESS_TOKEN: "legacy-token", META_CRM_PAGE_ID: "crm-page", META_PAGE_ID: "legacy-page" },
  });
  await f.module.backfillRecentMetaLeads();
  assert.ok(f.calls.some(url => url.pathname.endsWith("/crm-page/leadgen_forms")));
  assert.ok(f.calls.every(url => url.searchParams.get("access_token") === "crm-token"));
  assert.ok(f.calls.every(url => !url.pathname.includes("wrong-page") && !url.pathname.includes("legacy-page")));
});

test("legacy Instagram connection cannot displace the system Lead Ads token", async () => {
  const f = fixture({ env: { META_ACCESS_TOKEN: "system-leads", META_PAGE_ID: "leads-page" } });
  await f.module.backfillRecentMetaLeads();
  assert.ok(f.calls.some(url => url.pathname.endsWith("/leads-page/leadgen_forms")));
  assert.ok(f.calls.every(url => url.searchParams.get("access_token") === "system-leads"));
});

test("renewed CRM authorization takes precedence over legacy system token", async () => {
  const f = fixture({ saved: { appId: "crm-app", pageId: "renewed-page", token: "renewed", userToken: "renewed-user" }, env: { META_ACCESS_TOKEN: "old", META_PAGE_ID: "old-page" } });
  await f.module.backfillRecentMetaLeads();
  assert.ok(f.calls.some(url => url.pathname.endsWith("/renewed-page/leadgen_forms")));
  assert.ok(f.calls.every(url => url.searchParams.get("access_token") === "renewed"));
});

test("recovers known forms despite discovery and another form failing, without reporting complete success", async () => {
  const f = fixture({ handler: path => {
    if (path.endsWith("/leadgen_forms") || path === "858044513215666/leads") {
      return Response.json({ error: { code: 200, message: "DO NOT EXPOSE PRIVATE REQUEST DETAILS" } }, { status: 403 });
    }
    if (path === "1456527069869122/leads") return Response.json({ data: [{ id: "lead-1", created_time: new Date().toISOString() }] });
  } });
  const result = await f.module.backfillRecentMetaLeads();
  assert.equal(result.created, 1);
  assert.equal(result.discoveryErrors.length, 1);
  assert.equal(result.formErrors.length, 1);
  assert.equal(result.status, "partial");
  assert.equal(f.records[0].complete, false);
  assert.equal(result.lastLeadSyncAt, "2026-09-22T20:00:00.000Z");
  assert.ok(result.warnings.some(warning => warning.includes("código 200")));
  assert.ok(!JSON.stringify(result).includes("PRIVATE REQUEST"));
});

test("deduplicates discovered leads across forms and preserves existing contact ownership/status", async () => {
  const f = fixture({ existing: true, handler: path => path.endsWith("/leads") ? Response.json({
    data: [{ id: "lead-1", created_time: new Date().toISOString() }],
  }) : undefined });
  const result = await f.module.backfillRecentMetaLeads();
  assert.equal(result.found, 1);
  assert.equal(result.updated, 1);
  assert.equal(result.created, 0);
  assert.equal(f.imports.length, 1);
  assert.equal(f.imports[0].data.email, "client@example.com");
  assert.equal(f.imports[0].options.preserveExistingValues, true);
  assert.equal(f.imports[0].options.preservePopulatedFields, true);
  assert.equal(f.imports[0].options.leaveUnassignedOnCreate, true);
});

test("legacy recovery excludes default, configured and discovered forms without changing other contacts", async () => {
  const externalForm = "1473751244572870";
  const excluded = ["858044513215666", externalForm, "888"];
  const similarId = `${externalForm}0`;
  const f = fixture({
    existing: true,
    env: { META_LEAD_RECOVERY_EXCLUDED_FORM_IDS: ` ${excluded.join(", ")} `, META_LEAD_FORM_IDS: externalForm },
    handler: path => {
      if (path.endsWith("/leadgen_forms")) return Response.json({ data: [{ id: externalForm }, { id: "888" }, { id: similarId }] });
      if (excluded.some(id => path === `${id}/leads`)) return Response.json({ data: [{ id: "excluded-lead", created_time: new Date().toISOString() }] });
      if (path === `${similarId}/leads`) return Response.json({ data: [{ id: "lead-1", created_time: new Date().toISOString() }] });
    },
  });
  const result = await f.module.backfillRecentMetaLeads();
  assert.equal(result.status, "complete");
  assert.equal(result.forms, 3);
  assert.equal(result.found, 1); assert.equal(result.updated, 1); assert.equal(result.created, 0);
  assert.equal(result.errors.length, 0); assert.equal(result.formErrors.length, 0);
  assert.ok(excluded.every(id => f.calls.every(url => !url.pathname.endsWith(`/${id}/leads`))));
  assert.ok(f.calls.some(url => url.pathname.endsWith(`/${similarId}/leads`)));
  assert.ok(!f.calls.some(url => url.pathname.endsWith("/excluded-lead")));
  assert.equal(f.imports.length, 1);
  assert.equal(f.imports[0].options.preserveExistingValues, true);
  assert.equal(f.imports[0].options.preservePopulatedFields, true);
  assert.deepEqual(f.effects, ["notification", "activity"]);
});

test("legacy exclusion produces no contact writes and preserves unrelated page warnings", async () => {
  const externalForm = "1473751244572870";
  const f = fixture({
    env: { META_LEAD_RECOVERY_EXCLUDED_FORM_IDS: externalForm, META_LEAD_FORM_IDS: externalForm },
    handler: path => {
      if (path.endsWith("/leadgen_forms")) return Response.json({ error: { code: 200 } }, { status: 403 });
      if (path === `${externalForm}/leads`) return Response.json({ data: [{ id: "lead-1", created_time: new Date().toISOString() }] });
    },
  });
  const result = await f.module.backfillRecentMetaLeads();
  assert.equal(result.status, "partial");
  assert.equal(result.discoveryErrors.length, 1);
  assert.equal(result.formErrors.length, 0);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /^Formularios de la página saved-page:/);
  assert.ok(!f.calls.some(url => url.pathname.endsWith(`/${externalForm}/leads`)));
  assert.equal(f.imports.length, 0); assert.equal(f.effects.length, 0);
  assert.equal(f.records[0].complete, false);
});

test("a failed first recovery does not create a fake successful sync timestamp", async () => {
  const statements = [];
  const sql = async (strings, ...values) => { statements.push({ text: strings.join("?"), values }); return []; };
  sql.end = async () => {};
  const m = load("lib/meta-sync-state.ts", { postgres: () => sql }, { process: { env: { DATABASE_URL: "mock" } } });
  const result = await m.recordMetaLeadsSync({ status: "failed" }, false);
  assert.equal(result, null);
  assert.equal(statements.length, 1);
  assert.match(statements[0].text, /UPDATE crm_integration_sync_state/);
  assert.doesNotMatch(statements[0].text, /SET\s+last_success_at|INSERT/);
});

test("partial recovery preserves the previous successful timestamp and full recovery advances it", async () => {
  const statements = [];
  const sql = async (strings, ...values) => {
    const text = strings.join("?"); statements.push({ text, values });
    return [{ last_success_at: text.includes("INSERT") ? "2026-09-23T20:00:00Z" : "2026-09-22T20:00:00Z" }];
  };
  sql.end = async () => {};
  const m = load("lib/meta-sync-state.ts", { postgres: () => sql }, { process: { env: { DATABASE_URL: "mock" } } });
  assert.equal(await m.recordMetaLeadsSync({ status: "partial" }, false), "2026-09-22T20:00:00.000Z");
  assert.equal(await m.recordMetaLeadsSync({ status: "complete" }, true), "2026-09-23T20:00:00.000Z");
  assert.match(statements[1].text, /last_success_at = EXCLUDED.last_success_at/);
});

test("lead webhook signature uses CRM app secret, not WhatsApp or generic secret", () => {
  const f = fixture({ env: { META_APP_SECRET: "wrong-secret" } });
  const body = '{"object":"page"}';
  const sign = secret => "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(f.module.verifyMetaSignature(body, sign("crm-secret")), true);
  assert.equal(f.module.verifyMetaSignature(body, sign("wrong-secret")), false);
});
