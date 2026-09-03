"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarRange, CheckCircle2, Loader2, Pause, Play, RefreshCw, Target, UsersRound } from "lucide-react";
import type { MetaMarketingDashboard } from "@/lib/meta-ads";

const periods = [7, 30, 90] as const;

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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/crm/meta/campaigns?days=${days}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudieron cargar las campañas.");
      setData(payload);
    } catch (cause) {
      setData(null);
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar las campañas.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

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
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo cambiar la campaña.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cambiar la campaña.");
    } finally {
      setChanging(null);
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
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-md bg-red-50 px-4 py-3 text-sm leading-6 text-red-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="font-semibold">Meta necesita atención</p><p>{error}</p><p className="mt-1 text-red-800">Verificá que el token tenga los permisos <strong>ads_read</strong> y <strong>ads_management</strong>.</p></div>
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
