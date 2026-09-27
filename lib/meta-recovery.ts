import { getMetaCrmAppId } from "@/lib/meta-app-config";
import { createMetaImportContext, findProcessedMetaLeadIds, getKnownMetaFormIds, importMetaLeadgenId, metaLeadConnection, type MetaImportContext } from "@/lib/meta-leads";
import { claimMetaRecovery, getMetaRecovery, releaseMetaRecovery, saveMetaRecovery, type MetaRecoveryJob, type RecoveryStatus } from "@/lib/meta-recovery-store";
import { recordMetaLeadsSync } from "@/lib/meta-sync-state";
import { getExcludedMetaRecoveryFormIds } from "@/lib/meta-lead-recovery-policy";

type Form = { id: string; name: string; after?: string; pages: number; attempts: number; done: boolean; error?: string };
type Lead = { id: string; formId: string; attempts: number; outcome?: "created" | "updated" | "unchanged" | "skipped" | "error" };
type State = {
  version: 1; appId: string; pageId: string;
  phase: "discover" | "scan" | "import" | "done";
  forms: Form[]; leads: Lead[]; warnings: string[];
  discovery: { after?: string; pages: number; attempts: number };
  failures: number; lastError?: string;
};
const DEFAULT_FORMS = ["858044513215666", "1456527069869122", "1108265682151952"];
const validId = (value: string) => /^\d+$/.test(value);

class MetaReadError extends Error {
  constructor(message: string, readonly retryable: boolean) { super(message); }
}
class LeaseLost extends Error {}

// Persist cursors and IDs only. Graph's next URL contains credentials and is
// deliberately never saved or followed (also prevents credential redirection).
async function collection<T>(path: string, token: string, fields: string, after?: string) {
  const url = new URL(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v26.0"}/${path}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("limit", "100");
  if (after) url.searchParams.set("after", after);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error || !Array.isArray(payload?.data)) {
    const code = Number(payload?.error?.code) || 0;
    const subcode = Number(payload?.error?.error_subcode) || 0;
    const detail = code === 190 ? "La conexión del CRM venció o fue revocada; renová sus permisos."
      : code === 10 || code === 200 ? "Meta no autorizó el acceso; revisá los permisos del CRM y el acceso a clientes potenciales."
      : code === 100 ? "Meta no permite consultar este recurso: verificá su ID y el acceso de la página y del CRM."
      : "Meta no pudo responder a esta consulta.";
    throw new MetaReadError(`${detail} (HTTP ${response.status}, código ${code}${subcode ? `/${subcode}` : ""}).`, response.status >= 500 || response.status === 429 || [1, 2, 4, 17, 32, 613].includes(code));
  }
  const cursor = payload.paging?.cursors?.after;
  if (payload.paging?.next && (typeof cursor !== "string" || cursor === after)) {
    throw new MetaReadError("Meta devolvió una paginación incompleta; la consulta debe reintentarse.", true);
  }
  return { data: payload.data as T[], after: payload.paging?.next ? cursor as string : undefined };
}

function warning(state: State, value: string) {
  if (!state.warnings.includes(value) && state.warnings.length < 30) state.warnings.push(value);
}
function safeError(error: unknown) {
  return error instanceof MetaReadError ? error.message : "La consulta se interrumpió temporalmente; el avance quedó guardado para reintentar.";
}

export function metaRecoverySummary(job: MetaRecoveryJob | null) {
  if (!job) return null;
  const state = job.state as State | null;
  const leads = state?.leads || [];
  const count = (outcome: Lead["outcome"]) => leads.filter(lead => lead.outcome === outcome).length;
  const skipped = count("skipped");
  const errors = count("error");
  const warnings = [...(state?.warnings || [])];
  if (state?.lastError) warnings.push(state.lastError);
  if (skipped) warnings.push(`${skipped} consultas no se importaron porque Meta no incluyó un correo electrónico.`);
  if (errors) warnings.push(`${errors} consultas no pudieron guardarse después de tres intentos. Podés volver a recuperarlas sin duplicar contactos.`);
  return {
    id: job.id, status: job.status, phase: state?.phase || "discover",
    found: leads.length, processed: leads.filter(lead => lead.outcome).length,
    created: count("created"), updated: count("updated"), unchanged: count("unchanged"), skipped, errors,
    pending: count(undefined), forms: state?.forms.length || 0,
    formsSucceeded: state?.forms.filter(form => form.done && !form.error).length || 0,
    warnings, updatedAt: job.updatedAt, complete: job.status === "complete",
  };
}

async function initialState(pageId: string, excludedForms: Set<string>): Promise<State> {
  const ids = [...DEFAULT_FORMS, ...(process.env.META_LEAD_FORM_IDS || "").split(","), ...await getKnownMetaFormIds()];
  return {
    version: 1, appId: getMetaCrmAppId(), pageId, phase: "discover", failures: 0,
    forms: [...new Set(ids.map(id => id.trim()).filter(id => validId(id) && !excludedForms.has(id)))].map(id => ({ id, name: "", pages: 0, attempts: 0, done: false })),
    leads: [], warnings: [], discovery: { pages: 0, attempts: 0 },
  };
}

export async function processMetaRecovery() {
  const claimed = await claimMetaRecovery();
  if (!claimed) return metaRecoverySummary(await getMetaRecovery());
  const { job, lease } = claimed;
  let state = job.state as State | null;
  let context: MetaImportContext | undefined;
  const deadline = Date.now() + 75000;
  const save = async (status: RecoveryStatus = "running") => {
    if (!state || !await saveMetaRecovery(job.id, lease, state as unknown as Record<string, unknown>, status)) throw new LeaseLost();
    job.state = state as unknown as Record<string, unknown>; job.status = status; job.updatedAt = new Date().toISOString();
  };
  try {
    const connection = await metaLeadConnection();
    const pageId = connection.pageId || process.env.META_CRM_PAGE_ID || process.env.META_PAGE_ID || process.env.META_SOCIAL_PAGE_ID || process.env.FACEBOOK_PAGE_ID || "";
    const excludedForms = getExcludedMetaRecoveryFormIds();
    if (!state) state = await initialState(pageId, excludedForms);
    if (state.appId !== getMetaCrmAppId() || state.pageId !== pageId) {
      warning(state, "La página o app del CRM cambió durante la recuperación. Iniciá una nueva recuperación con la conexión actual.");
      await save("failed"); return metaRecoverySummary(job);
    }
    // Apply newly configured exclusions to resumed jobs as well as new jobs.
    // Only the recovery work queue is filtered; CRM records remain untouched.
    state.forms = state.forms.filter(form => !excludedForms.has(form.id));
    state.leads = state.leads.filter(lead => !excludedForms.has(lead.formId));
    state.warnings = state.warnings.filter(message => {
      const formId = /^Formulario (\d+):/.exec(message)?.[1];
      return !formId || !excludedForms.has(formId);
    });
    if (!connection.token) {
      warning(state, "Falta conectar Barrera Brokers CRM para recuperar los formularios. WhatsApp Omnicanal es una conexión independiente.");
      await save("failed"); return metaRecoverySummary(job);
    }
    await save();
    let imported = 0;
    // Bounded time and work count, well below the 300s Vercel limit. Every
    // successful page/lead is checkpointed; the next cron resumes this job.
    for (let steps = 0; steps < 12 && Date.now() < deadline && imported < 5; steps++) {
      if (state.phase === "discover") {
        if (!validId(pageId)) {
          warning(state, "Falta configurar la página del CRM; solo se revisarán los formularios conocidos.");
          state.phase = "scan"; await save(); continue;
        }
        try {
          const result = await collection<{ id: string; name?: string }>(`${pageId}/leadgen_forms`, connection.token, "id,name", state.discovery.after);
          for (const form of result.data) {
            if (!form.id || !validId(form.id) || excludedForms.has(form.id)) continue;
            const existing = state.forms.find(item => item.id === form.id);
            if (existing) existing.name = form.name || existing.name;
            else state.forms.push({ id: form.id, name: form.name || "", pages: 0, attempts: 0, done: false });
          }
          state.discovery.pages++; state.discovery.attempts = 0; state.discovery.after = result.after;
          if (!result.after) state.phase = "scan";
          else if (state.discovery.pages >= 20) {
            warning(state, "Se alcanzó el límite de 2000 formularios; el descubrimiento quedó incompleto."); state.phase = "scan";
          }
        } catch (error) {
          if (error instanceof LeaseLost) throw error;
          state.discovery.attempts++;
          if (error instanceof MetaReadError && !error.retryable || state.discovery.attempts >= 3) {
            warning(state, `Formularios de la página ${pageId}: ${safeError(error)}`); state.phase = "scan";
          } else { await save(); break; }
        }
        await save(); continue;
      }
      if (state.phase === "scan") {
        const form = state.forms.find(item => !item.done);
        if (!form) { state.phase = "import"; await save(); continue; }
        try {
          const result = await collection<{ id: string; created_time?: string }>(`${form.id}/leads`, connection.token, "id,created_time", form.after);
          const known = new Set(state.leads.map(lead => lead.id));
          for (const lead of result.data) {
            const date = lead.created_time ? Date.parse(lead.created_time) : NaN;
            if (!validId(lead.id) || known.has(lead.id) || Number.isFinite(date) && (date < Date.parse(job.since) || date > Date.parse(job.until))) continue;
            known.add(lead.id); state.leads.push({ id: lead.id, formId: form.id, attempts: 0 });
          }
          form.pages++; form.attempts = 0; form.after = result.after;
          if (!result.after) form.done = true;
          else if (form.pages >= 100 || state.leads.length >= 50000) {
            form.done = true; form.error = "Se alcanzó el límite de lectura; este formulario quedó incompleto.";
            warning(state, `Formulario ${form.id}: ${form.error}`);
          }
        } catch (error) {
          form.attempts++;
          if (error instanceof MetaReadError && !error.retryable || form.attempts >= 3) {
            form.done = true; form.error = safeError(error); warning(state, `Formulario ${form.id}: ${form.error}`);
          } else { await save(); break; }
        }
        await save(); continue;
      }
      if (state.phase === "import") {
        const pending = state.leads.filter(lead => !lead.outcome).slice(0, 50);
        if (!pending.length) { state.phase = "done"; await save(); continue; }
        const already = await findProcessedMetaLeadIds(pending.map(lead => lead.id));
        for (const lead of pending) if (already.has(lead.id)) lead.outcome = "unchanged";
        // Existing submissions are not rewritten, avoiding repeated activity,
        // notifications and AI analysis on each scheduled recovery.
        if (already.size) { await save(); continue; }
        const lead = pending[0];
        try {
          context ||= await createMetaImportContext(connection.token, new Map(state.forms.filter(form => form.name).map(form => [form.id, form.name])));
          const result = await importMetaLeadgenId(lead.id, { createdBy: job.createdBy, context, webhookValue: { form_id: lead.formId, page_id: pageId || undefined } });
          lead.outcome = result.skipped ? "skipped" : result.created ? "created" : "updated";
          state.failures = 0; delete state.lastError;
        } catch {
          lead.attempts++;
          if (lead.attempts >= 3) lead.outcome = "error";
          else { await save(); break; }
        }
        imported++; await save(); continue;
      }
      const summary = metaRecoverySummary(job)!;
      const complete = !state.warnings.length && !summary.skipped && !summary.errors;
      const status = complete ? "complete" : summary.formsSucceeded === 0 && summary.created + summary.updated + summary.unchanged === 0 ? "failed" : "partial";
      delete state.lastError;
      await recordMetaLeadsSync({ ...summary, status, complete }, complete);
      await save(status); break;
    }
    return metaRecoverySummary(job);
  } catch (error) {
    if (error instanceof LeaseLost) return metaRecoverySummary(await getMetaRecovery());
    if (state) {
      state.failures++; state.lastError = "El servicio de recuperación se interrumpió. El avance está guardado y Vercel volverá a intentarlo.";
      await save(state.failures >= 3 ? "failed" : "running");
      return metaRecoverySummary(job);
    }
    throw new Error("No se pudo iniciar la recuperación. El trabajo permanece en cola para el próximo intento.");
  } finally {
    await releaseMetaRecovery(job.id, lease);
  }
}
