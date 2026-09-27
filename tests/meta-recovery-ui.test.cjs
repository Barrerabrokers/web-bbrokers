const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync("components/admin/meta-campaign-dashboard.tsx", "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const dashboard = {
  account: { name: "Barrera", currency: "USD" },
  totals: { spend: 100, leads: 10, crmLeads: 8, qualifiedLeads: 2, meetings: 1, costPerLead: 10, costPerQualifiedLead: 50 },
  period: { since: "2026-09-01", until: "2026-09-23" },
  lastLeadSyncAt: "2026-09-23T12:00:00Z", updatedAt: "2026-09-23T12:00:00Z", campaigns: [], warnings: [],
};
function job(overrides = {}) {
  return { id: "recovery-1", status: "running", phase: "scan", found: 12, processed: 4, created: 2, updated: 1, unchanged: 1, skipped: 0, errors: 0, pending: 8, forms: 2, formsSucceeded: 1, warnings: [], updatedAt: "2026-09-23T12:00:00Z", complete: false, ...overrides };
}
function harness({ fetcher = async () => Response.json({ recovery: null }), hidden = false } = {}) {
  const hooks = [];
  const pendingEffects = [];
  const timers = new Map();
  const listeners = new Map();
  const requests = [];
  let cursor = 0, nextTimer = 0, dirty = false, tree;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!hooks[i]) hooks[i] = { value: initial };
      return [hooks[i].value, value => { hooks[i].value = typeof value === "function" ? value(hooks[i].value) : value; dirty = true; }];
    },
    useRef(initial) {
      const i = cursor++;
      if (!hooks[i]) hooks[i] = { current: initial };
      return hooks[i];
    },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!hooks[i] || !same(hooks[i].deps, deps)) hooks[i] = { value: fn, deps };
      return hooks[i].value;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!hooks[i] || !same(hooks[i].deps, deps)) {
        const old = hooks[i];
        hooks[i] = { deps, cleanup: old?.cleanup };
        pendingEffects.push(() => { old?.cleanup?.(); hooks[i].cleanup = fn(); });
      }
    },
  };
  const doc = {
    hidden,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); },
  };
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, Intl, Date, AbortController, console, document: doc,
    window: { confirm: () => true },
    setTimeout: (fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id),
    fetch: async (url, options = {}) => { requests.push({ url, ...options }); return fetcher(url, options); },
    require: name => {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "fragment" };
      if (name === "lucide-react") return new Proxy({}, { get: (_, key) => key });
      if (name === "@/lib/argentina-time") return { ARGENTINA_TIME_ZONE: "America/Argentina/Buenos_Aires" };
      throw new Error("Unexpected module: " + name);
    },
  });
  function render() { cursor = 0; dirty = false; tree = module.exports.MetaCampaignDashboard(); while (pendingEffects.length) pendingEffects.shift()(); }
  async function flush() {
    for (let i = 0; i < 12; i++) {
      await new Promise(resolve => setImmediate(resolve));
      if (dirty) render();
    }
  }
  function nodes(value = tree) {
    if (value == null || typeof value === "boolean") return [];
    if (Array.isArray(value)) return value.flatMap(nodes);
    return [value, ...(typeof value === "object" ? nodes(value.props?.children ?? null) : [])];
  }
  function text(value = tree) { return nodes(value).filter(v => typeof v === "string" || typeof v === "number").join(" "); }
  return {
    exports: module.exports, requests, timers, document: doc, render, flush, text,
    button(label) { return nodes().find(n => n?.type === "button" && text(n).includes(label)); },
    visibility(value) { doc.hidden = value; listeners.get("visibilitychange")?.(); },
    tick() { const tasks = [...timers.values()]; timers.clear(); tasks.forEach(t => t.fn()); },
    unmount() { hooks.forEach(h => h?.cleanup?.()); },
  };
}

test("recovery presentation distinguishes permission denial, partial timeout, and completion", () => {
  const m = harness().exports;
  assert.equal(m.isMetaRecoveryActive(null), false);
  assert.equal(m.isMetaRecoveryActive(job({ status: "queued" })), true);
  assert.equal(m.isMetaRecoveryActive(job({ status: "partial" })), false);
  assert.match(m.metaRecoveryPresentation(job()).detail, /total puede aumentar.*Podés cerrar/);
  const partial = m.metaRecoveryPresentation(job({ status: "partial", warnings: ["La consulta superó el tiempo de espera."] }));
  assert.equal(partial.tone, "warning");
  assert.equal(partial.accessWarning, false);
  assert.doesNotMatch(partial.detail, /permis|conexión|acceso/);
  const permission = m.metaRecoveryPresentation(job({ status: "partial", warnings: ["Meta no autorizó el acceso (200)."] }));
  assert.equal(permission.accessWarning, true);
  assert.match(permission.detail, /Barrera Brokers CRM/);
  assert.equal(m.metaRecoveryPresentation(job({ status: "complete" })).tone, "success");
});

test("mount resumes persisted status, polls only active jobs, pauses hidden, stops terminal", async () => {
  let current = job();
  const h = harness({ fetcher: async url => Response.json(url.includes("/campaigns") ? dashboard : { recovery: current }) });
  h.render(); await h.flush();
  assert.match(h.text(), /Recuperación en segundo plano/);
  assert.equal(h.button("Recuperando").props.disabled, true);
  assert.equal(h.timers.size, 1);
  assert.equal([...h.timers.values()][0].ms, 15000);
  assert.ok(h.requests.every(r => !r.method || r.method === "GET"));
  h.visibility(true);
  assert.equal(h.timers.size, 0);
  const before = h.requests.length;
  h.tick(); await h.flush();
  assert.equal(h.requests.length, before);
  current = job({ status: "complete", phase: "done", complete: true, pending: 0 });
  h.visibility(false); await h.flush();
  assert.equal(h.timers.size, 0);
  assert.match(h.text(), /Recuperación completada/);
  assert.equal(h.button("Recuperar leads de Meta").props.disabled, false);
  h.unmount();
});

test("queued job is only enqueued once; browser never runs a worker", async () => {
  let current = null;
  const h = harness({ fetcher: async (url, opts) => {
    if (url.includes("/campaigns")) return Response.json(dashboard);
    if (opts.method === "POST") { current = job({ status: "queued", phase: "discover" }); return Response.json({ recovery: current }, { status: 202 }); }
    return Response.json({ recovery: current });
  } });
  h.render(); await h.flush();
  h.button("Recuperar leads de Meta").props.onClick(); await h.flush();
  h.tick(); await h.flush();
  assert.equal(h.requests.filter(r => r.method === "POST").length, 1);
  assert.ok(h.requests.every(r => r.url.includes("/campaigns") || r.url === "/api/crm/meta/backfill"));
  assert.match(h.text(), /solicitud está en cola/);
  h.unmount(); assert.equal(h.timers.size, 0);
});

test("refresh error preserves successful campaign data and does not invent permission failure", async () => {
  let fail = false;
  const h = harness({ fetcher: async url => {
    if (!url.includes("/campaigns")) return Response.json({ recovery: null });
    return fail ? Response.json({ error: "La consulta superó el tiempo de espera." }, { status: 504 }) : Response.json(dashboard);
  } });
  h.render(); await h.flush();
  assert.match(h.text(), /Barrera · USD/);
  fail = true; h.button("Actualizar").props.onClick(); await h.flush();
  assert.match(h.text(), /Barrera · USD/);
  assert.match(h.text(), /Se conserva el último informe/);
  assert.doesNotMatch(h.text(), /Revisá los permisos/);
  h.unmount();
});

test("status reads abort on hiding and unmount; a hidden mount does not start polling", async () => {
  const h = harness({ hidden: true, fetcher: async url => url.includes("/campaigns") ? Response.json(dashboard) : new Promise(() => {}) });
  h.render(); await h.flush();
  assert.equal(h.requests.filter(r => r.url.endsWith("/backfill")).length, 0);
  h.visibility(false); await h.flush();
  const first = h.requests.find(r => r.url.endsWith("/backfill"));
  h.visibility(true); assert.equal(first.signal.aborted, true);
  h.visibility(false); await h.flush();
  const last = h.requests.at(-1);
  h.unmount(); assert.equal(last.signal.aborted, true);
});

test("lost enqueue response reconciles server state instead of starting again", async () => {
  let current = null;
  const h = harness({ fetcher: async (url, opts) => {
    if (url.includes("/campaigns")) return Response.json(dashboard);
    if (opts.method === "POST") { current = job({ status: "queued" }); throw new Error("Connection lost"); }
    return Response.json({ recovery: current });
  } });
  h.render(); await h.flush();
  h.button("Recuperar leads de Meta").props.onClick(); await h.flush();
  assert.match(h.text(), /Recuperación en segundo plano/);
  assert.doesNotMatch(h.text(), /Connection lost/);
  assert.equal(h.requests.filter(r => r.method === "POST").length, 1);
  h.unmount();
});
