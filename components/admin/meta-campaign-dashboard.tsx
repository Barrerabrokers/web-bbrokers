"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarRange, CheckCircle2, Loader2, Pause, Play, RefreshCw, Target, UsersRound } from "lucide-react";
import type { MetaMarketingDashboard } from "@/lib/meta-ads";
import { ARGENTINA_TIME_ZONE } from "@/lib/argentina-time";

const periods = [7, 30, 90] as const;

type MetaLeadRecovery = {
  id: string;
  status: "queued" | "running" | "complete" | "partial" | "failed";
  phase: "discover" | "scan" | "import" | "done";
  found: number;
  processed: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  errors: number;
  pending: number;
  forms: number;
  formsSucceeded: number;
  warnings: string[];
  updatedAt: string;
  complete: boolean;
};

export function isMetaRecoveryActive(recovery: MetaLeadRecovery | null) {
  return recovery?.status === "queued" || recovery?.status === "running";
}

export function hasMetaAccessWarning(messages: string[]) {
  return messages.some((message) => /permis|acceso|autoriz|token|credential|credencial|oauth|permission|access denied|ads_read|ads_management|leads_retrieval|pages_show_list|pages_read_engagement|pages_manage_metadata/i.test(message));
}

export function metaRecoveryPresentation(recovery: MetaLeadRecovery) {
  const accessWarning = hasMetaAccessWarning(recovery.warnings);
  if (isMetaRecoveryActive(recovery)) {
    const phase = recovery.status === "queued" ? "La solicitud está en cola." : {
      discover: "Buscando los formularios disponibles en Meta.",
      scan: "Consultando los contactos de los formularios. El total puede aumentar.",
      import: "Guardando los contactos en el CRM.",
      done: "Terminando la recuperación.",
    }[recovery.phase];
    return { tone: "active", title: "Recuperación en segundo plano", detail: `${phase} Podés cerrar esta página.`, accessWarning } as const;
  }
  if (recovery.status === "complete") {
    return { tone: "success", title: "Recuperación completada", detail: "Se terminó de procesar la recuperación de contactos.", accessWarning } as const;
  }
  if (recovery.status === "partial") {
    return {
      tone: "warning", title: "Recuperación incompleta",
      detail: accessWarning ? "Meta no permitió consultar todos los formularios. Revisá el acceso de Barrera Brokers CRM a las páginas y los leads." : "Se guardaron los avances, pero quedaron contactos o formularios sin procesar. Revisá los avisos antes de volver a intentar.",
      accessWarning,
    } as const;
  }
  return {
    tone: "error", title: "No se pudo completar la recuperación",
    detail: accessWarning ? "Revisá el acceso de Barrera Brokers CRM a las páginas y los leads." : "Los avances guardados se conservan. Revisá el detalle antes de volver a intentar.",
    accessWarning,
  } as const;
}

function compact(value: number) {
  return new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function decimal(value: number, digits = 1) {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function money(value: number | null, currency: string) {
  if (value === null) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function syncDateTime(value: string | null | undefined) {
  if (!value) return "Todavía sin actualizaciones";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Todavía sin actualizaciones";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ARGENTINA_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function readPayload(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(response.ok ? "Meta devolvió una respuesta inválida." : "No se pudo completar la consulta con Meta.");
  }
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 border-b border-ink/10 py-4 lg:border-b-0 lg:border-r lg:px-5 first:lg:pl-0 last:border-0">
      <p className="text-sm font-medium text-ink/62">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-ink">{value}</p>
      <p className="mt-1 text-xs leading-5 text-ink/55">{detail}</p>
    </div>
  );
}

export function MetaCampaignDashboard() {
  const [days, setDays] = useState<(typeof periods)[number]>(30);
  const [data, setData] = useState<MetaMarketingDashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState<string | null>(null);
  const [startingRecovery, setStartingRecovery] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(true);
  const [recovery, setRecovery] = useState<MetaLeadRecovery | null>(null);
  const [recoveryError, setRecoveryError] = useState("");
  const [recoveryStatusError, setRecoveryStatusError] = useState("");
  const [recoveryCheck, setRecoveryCheck] = useState(0);
  const recoveryRef = useRef<MetaLeadRecovery | null>(null);
  const campaignRequest = useRef<AbortController | null>(null);
  const recoveryStartRequest = useRef<AbortController | null>(null);
  const recovering = isMetaRecoveryActive(recovery);
  const recoveryPresentation = recovery ? metaRecoveryPresentation(recovery) : null;

  const load = useCallback(async () => {
    campaignRequest.current?.abort();
    const controller = new AbortController();
    campaignRequest.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/crm/meta/campaigns?days=${days}`, { cache: "no-store", signal: controller.signal });
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(payload.error || "No se pudieron cargar las campañas.");
      if (!controller.signal.aborted) setData(payload);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudieron cargar las campañas.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [days]);

  const latestLoad = useRef(load);
  latestLoad.current = load;

  useEffect(() => {
    void load();
    return () => campaignRequest.current?.abort();
  }, [load]);

  useEffect(() => () => recoveryStartRequest.current?.abort(), []);

  // Status reads only: processing belongs to the server and continues with this page closed.
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | null = null;

    function clearTimer() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    }

    async function checkStatus() {
      if (disposed || document.hidden) return;
      clearTimer();
      request?.abort();
      const controller = new AbortController();
      request = controller;
      try {
        const response = await fetch("/api/crm/meta/backfill", { cache: "no-store", signal: controller.signal });
        const payload = await readPayload(response);
        if (!response.ok) throw new Error(payload.error || "No se pudo consultar el estado de la recuperación.");
        if (!("recovery" in payload)) throw new Error("No se recibió el estado de la recuperación.");
        if (disposed || controller.signal.aborted) return;
        const next: MetaLeadRecovery | null = payload.recovery;
        const previous = recoveryRef.current;
        recoveryRef.current = next;
        setRecovery(next);
        setRecoveryStatusError("");
        if (next && isMetaRecoveryActive(next)) setRecoveryError("");
        if (next && previous?.id === next.id && isMetaRecoveryActive(previous) && !isMetaRecoveryActive(next)) {
          void latestLoad.current();
        }
      } catch (cause) {
        if (!disposed && !controller.signal.aborted) {
          setRecoveryStatusError(cause instanceof Error ? cause.message : "No se pudo consultar el estado de la recuperación.");
        }
      } finally {
        if (!disposed && request === controller && !controller.signal.aborted) {
          setRecoveryLoading(false);
          request = null;
          if (!document.hidden && isMetaRecoveryActive(recoveryRef.current)) {
            timer = setTimeout(() => void checkStatus(), 15_000);
          }
        }
      }
    }

    function visibilityChanged() {
      if (document.hidden) {
        clearTimer();
        request?.abort();
      } else {
        void checkStatus();
      }
    }

    void checkStatus();
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      disposed = true;
      clearTimer();
      request?.abort();
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [recoveryCheck]);

  async function changeStatus(campaign: MetaMarketingDashboard["campaigns"][number]) {
    const nextStatus = campaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    const verb = nextStatus === "PAUSED" ? "pausar" : "activar";
    if (!window.confirm(`¿Querés ${verb} “${campaign.name}”? El cambio se aplicará inmediatamente en Meta.`)) return;
    setChanging(campaign.id);
    setError("");
    try {
      const response = await fetch("/api/crm/meta/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id, status: nextStatus }),
      });
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(payload.error || "No se pudo cambiar la campaña.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cambiar la campaña.");
    } finally {
      setChanging(null);
    }
  }

  async function recoverLeads() {
    if (recoveryStartRequest.current || isMetaRecoveryActive(recoveryRef.current)) return;
    const controller = new AbortController();
    recoveryStartRequest.current = controller;
    setStartingRecovery(true);
    setRecoveryError("");
    try {
      const response = await fetch("/api/crm/meta/backfill", { method: "POST", signal: controller.signal });
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(payload.error || "No se pudo iniciar la recuperación.");
      if (!payload.recovery) throw new Error("No se pudo confirmar el inicio de la recuperación.");
      if (controller.signal.aborted) return;
      recoveryRef.current = payload.recovery;
      setRecovery(payload.recovery);
    } catch (cause) {
      if (!controller.signal.aborted) setRecoveryError(cause instanceof Error ? cause.message : "No se pudo iniciar la recuperación.");
    } finally {
      if (!controller.signal.aborted) {
        recoveryStartRequest.current = null;
        setStartingRecovery(false);
        // Reconcile even after a lost POST response: the server may have accepted the job.
        setRecoveryLoading(true);
        setRecoveryCheck((value) => value + 1);
      }
    }
  }

  return (
    <div className="space-y-5">
      <section className="border-y border-ink/12 bg-white px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="h-2.5 w-2.5 rounded-full bg-[#1877F2]" aria-hidden="true" />
              Meta Ads
            </div>
            <p className="mt-1 text-sm text-ink/58">{data ? `${data.account.name} · ${data.account.currency}` : "Campañas, inversión y calidad comercial en un solo lugar."}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-ink/14 bg-cream-50 p-1" aria-label="Período del informe">
              {periods.map((period) => (
                <button key={period} onClick={() => setDays(period)} className={`rounded px-3 py-2 text-sm font-medium transition-colors ${days === period ? "bg-ink text-white" : "text-ink/65 hover:bg-white"}`}>
                  {period} días
                </button>
              ))}
            </div>
            <button onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-ink/18 px-3 text-sm font-semibold text-ink hover:bg-cream-50 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
            </button>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-xs font-medium text-ink/58">
                Última actualización: <time className="text-ink/78" dateTime={data?.lastLeadSyncAt || undefined}>{syncDateTime(data?.lastLeadSyncAt)}</time>
              </p>
              <button onClick={() => void recoverLeads()} disabled={recovering || startingRecovery || recoveryLoading} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-accent px-3 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50">
                <RefreshCw aria-hidden="true" className={`h-4 w-4 ${recovering || startingRecovery || recoveryLoading ? "animate-spin motion-reduce:animate-none" : ""}`} /> {startingRecovery ? "Iniciando…" : recovering ? "Recuperando…" : recoveryLoading ? "Consultando estado…" : "Recuperar leads de Meta"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-md bg-red-50 px-4 py-3 text-sm leading-6 text-red-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">{data ? "No se pudieron actualizar las campañas" : "No se pudieron cargar las campañas"}</p>
            <p>{error}</p>
            {data && <p className="mt-1">Se conserva el último informe disponible. Sus cifras todavía no incluyen esta actualización.</p>}
            <p className="mt-1 text-red-800">{hasMetaAccessWarning([error]) ? "Revisá los permisos de la conexión Barrera Brokers CRM para campañas." : "Volvé a intentar con Actualizar. Este error no indica por sí solo un problema de permisos."}</p>
          </div>
        </div>
      )}

      {(recoveryError || recoveryStatusError) && (
        <div role="alert" className="flex items-start gap-3 rounded-md bg-[#fff7df] px-4 py-3 text-sm leading-6 text-[#5b4300]">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">No se pudo confirmar el estado de la recuperación</p>
            {recoveryError && <p>{recoveryError}</p>}
            {recoveryStatusError && recoveryStatusError !== recoveryError && <p>{recoveryStatusError}</p>}
            <p>Esto no cancela un trabajo que ya se esté ejecutando en el servidor.</p>
            <button onClick={() => { setRecoveryLoading(true); setRecoveryCheck((value) => value + 1); }} disabled={recoveryLoading} className="mt-2 min-h-10 rounded-md border border-current px-3 font-semibold disabled:opacity-50">Consultar estado</button>
          </div>
        </div>
      )}

      {recovery && recoveryPresentation && (
        <div role="status" aria-live="polite" className={`flex items-start gap-3 rounded-md px-4 py-3 text-sm leading-6 ${recoveryPresentation.tone === "success" ? "bg-emerald-50 text-emerald-900" : recoveryPresentation.tone === "warning" ? "bg-[#fff7df] text-[#5b4300]" : recoveryPresentation.tone === "error" ? "bg-red-50 text-red-900" : "bg-ink/5 text-ink"}`}>
          {recovering ? <Loader2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-spin motion-reduce:animate-none" /> : recoveryPresentation.tone === "success" ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
          <div className="min-w-0">
            <p className="font-semibold">{recoveryPresentation.title}</p>
            <p>{recoveryPresentation.detail}</p>
            <p className="mt-1 tabular-nums">{recovery.created} nuevos · {recovery.updated} actualizados · {recovery.unchanged} sin cambios · {recovery.skipped} omitidos</p>
            <p className="tabular-nums">{recovery.processed} contactos procesados · {recovery.found} encontrados · {recovery.pending} pendientes</p>
            <p className="tabular-nums">{recovery.formsSucceeded} de {recovery.forms} formularios consultados{recovery.errors > 0 ? ` · ${recovery.errors} errores registrados` : ""}</p>
            {recovery.warnings.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5">{recovery.warnings.map((warning, index) => <li className="break-words" key={`${index}-${warning}`}>{warning}</li>)}</ul>}
            <p className="mt-2 text-xs">Último avance: <time dateTime={recovery.updatedAt}>{syncDateTime(recovery.updatedAt)}</time></p>
          </div>
        </div>
      )}

      {loading && !data ? (
        <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-ink/58"><Loader2 className="h-5 w-5 animate-spin" /> Consultando Meta y el CRM…</div>
      ) : data ? (
        <>
          <section className="bg-white px-5 sm:px-6">
            <div className="grid lg:grid-cols-5">
              <Metric label="Inversión" value={money(data.totals.spend, data.account.currency)} detail={`${data.period.since} al ${data.period.until}`} />
              <Metric label="Leads de Meta" value={compact(data.totals.leads)} detail={`${money(data.totals.costPerLead, data.account.currency)} por lead`} />
              <Metric label="Leads en CRM" value={compact(data.totals.crmLeads)} detail="Con atribución reconocida" />
              <Metric label="Calificados" value={compact(data.totals.qualifiedLeads)} detail={`${money(data.totals.costPerQualifiedLead, data.account.currency)} por calificado`} />
              <Metric label="Reuniones" value={compact(data.totals.meetings)} detail={`${decimal(data.totals.crmLeads ? data.totals.meetings / data.totals.crmLeads * 100 : 0)}% de los leads CRM`} />
            </div>
          </section>

          {data.warnings.map((warning) => (
            <div key={warning} className="flex items-start gap-3 rounded-md bg-[#fff7df] px-4 py-3 text-sm leading-6 text-[#5b4300]">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><p>{warning}</p>
            </div>
          ))}

          <section className="overflow-hidden bg-white">
            <div className="flex flex-col gap-2 border-b border-ink/10 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
              <div><h2 className="text-xl font-semibold tracking-tight text-ink">Campañas</h2><p className="mt-1 text-sm text-ink/55">Ordenadas por inversión. Pausar o activar requiere confirmación.</p></div>
              <p className="text-xs text-ink/48">Actualizado {new Date(data.updatedAt).toLocaleString("es-AR")}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-cream-50 text-xs font-semibold text-ink/62">
                  <tr><th className="px-6 py-3">Campaña</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Inversión</th><th className="px-4 py-3 text-right">Leads</th><th className="px-4 py-3 text-right">CPL</th><th className="px-4 py-3 text-right">CTR</th><th className="px-4 py-3 text-right">CRM</th><th className="px-4 py-3 text-right">Calificados</th><th className="px-4 py-3 text-right">Reuniones</th><th className="px-6 py-3 text-right">Acción</th></tr>
                </thead>
                <tbody className="divide-y divide-ink/8">
                  {data.campaigns.map((campaign) => {
                    const active = campaign.status === "ACTIVE";
                    const quality = campaign.crmLeads > 0 ? campaign.qualifiedLeads / campaign.crmLeads * 100 : 0;
                    return (
                      <tr key={campaign.id} className="align-middle hover:bg-cream-50/70">
                        <td className="px-6 py-4"><p className="max-w-[340px] font-semibold text-ink">{campaign.name}</p><p className="mt-1 text-xs text-ink/48">ID {campaign.id}</p></td>
                        <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-emerald-50 text-emerald-800" : "bg-ink/6 text-ink/58"}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-600" : "bg-ink/35"}`} />{active ? "Activa" : "Pausada"}</span></td>
                        <td className="px-4 py-4 text-right font-medium">{money(campaign.spend, data.account.currency)}</td>
                        <td className="px-4 py-4 text-right">{compact(campaign.leads)}</td>
                        <td className="px-4 py-4 text-right">{money(campaign.costPerLead, data.account.currency)}</td>
                        <td className="px-4 py-4 text-right">{decimal(campaign.ctr, 2)}%</td>
                        <td className="px-4 py-4 text-right">{campaign.crmLeads}</td>
                        <td className="px-4 py-4 text-right"><span className="inline-flex items-center gap-1 font-semibold text-ink">{campaign.qualifiedLeads}{quality >= 15 ? <ArrowUpRight className="h-4 w-4 text-emerald-700" /> : <ArrowDownRight className="h-4 w-4 text-amber-700" />}</span></td>
                        <td className="px-4 py-4 text-right">{campaign.meetings}</td>
                        <td className="px-6 py-4 text-right"><button onClick={() => void changeStatus(campaign)} disabled={changing === campaign.id} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-ink/18 px-3 font-semibold text-ink hover:bg-cream-100 disabled:opacity-50">{changing === campaign.id ? <Loader2 className="h-4 w-4 animate-spin" /> : active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{active ? "Pausar" : "Activar"}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-px overflow-hidden rounded-md bg-ink/10 sm:grid-cols-3">
            <div className="bg-white p-5"><Target className="h-5 w-5 text-accent" /><h3 className="mt-3 font-semibold text-ink">Optimizar por calidad</h3><p className="mt-1 text-sm leading-6 text-ink/58">Compará CPL con calificados y reuniones antes de aumentar presupuesto.</p></div>
            <div className="bg-white p-5"><UsersRound className="h-5 w-5 text-accent" /><h3 className="mt-3 font-semibold text-ink">Atribución CRM</h3><p className="mt-1 text-sm leading-6 text-ink/58">Cada lead debe conservar campaña y anuncio para medir el recorrido completo.</p></div>
            <div className="bg-white p-5"><CalendarRange className="h-5 w-5 text-accent" /><h3 className="mt-3 font-semibold text-ink">Decisión semanal</h3><p className="mt-1 text-sm leading-6 text-ink/58">Revisá siete días completos y evitá decisiones por variaciones de un solo día.</p></div>
          </section>
        </>
      ) : null}
    </div>
  );
}
