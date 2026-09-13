"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import type { CrmLead } from "@/lib/db";
import { MetaCampaignDashboard } from "@/components/admin/meta-campaign-dashboard";

export function CrmMarketingWorkspace({ inbox }: { inbox: ReactNode }) {
  const [tab, setTab] = useState("contacts");
  const [webhookNotice, setWebhookNotice] = useState("");
  const [settingWebhook, setSettingWebhook] = useState(false);
  const [connectionResult, setConnectionResult] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ leads: CrmLead[]; total: number; conversations?: Record<string, string> }>({ leads: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<{ connected: boolean; message: string; instagramName?: string; canReadInstagram?: boolean } | null>(null);
  useEffect(() => {
    setConnectionResult(new URLSearchParams(window.location.search).get("metaConnection") || "");
    const controller = new AbortController();
    fetch("/api/crm/meta/connection", { cache: "no-store", signal: controller.signal }).then(r => r.ok ? r.json() : Promise.reject()).then(setConnection).catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (tab !== "contacts") return;
    const controller = new AbortController();
    setLoading(true);
    async function load() {
      try {
        const params = new URLSearchParams({ source: "meta", owner: "all", query, page: String(page), pageSize: "25" });
        const response = await fetch(`/api/crm/leads?${params}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("No se pudieron cargar los contactos. Intentá actualizar la página.");
        const payload = await response.json();
        setData(payload); setError("");
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se pudo consultar el CRM."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    const timer = window.setTimeout(load, 250);
    const refresh = window.setInterval(load, 15000);
    return () => { controller.abort(); window.clearTimeout(timer); window.clearInterval(refresh); };
  }, [query, page, tab]);

  async function configureReception() {
    setSettingWebhook(true); setWebhookNotice("");
    try {
      const response = await fetch("/api/crm/meta/connection", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo configurar.");
      setWebhookNotice("Recepción de Instagram configurada y verificada por Meta.");
    } catch (error) { setWebhookNotice(error instanceof Error ? error.message : "No se pudo configurar la recepción."); }
    finally { setSettingWebhook(false); }
  }
  return <>
    <nav aria-label="Secciones de Marketing" className="mb-5 flex gap-2 overflow-x-auto border-b border-ink/15 pb-3">
      {[["contacts", "Contactos de Meta"], ["messages", "Mensajes / Instagram"], ["campaigns", "Campañas"]].map(([value, label]) => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)} className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold ${tab === value ? "bg-accent text-white" : "bg-white text-ink hover:bg-cream-50"}`}>{label}</button>)}
    </nav>
    {connection && <div role="status" className={`mb-5 rounded-lg border p-4 text-sm ${connection.canReadInstagram ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}><strong>{connection.instagramName ? `Instagram · @${connection.instagramName}` : "Conexión con Instagram"}</strong><p className="mt-1">{connection.message}</p>{!connection.canReadInstagram && <a href="/api/crm/meta/connect" className="mt-3 inline-block rounded-md bg-accent px-4 py-2 font-semibold text-white">Autorizar Instagram con Meta</a>}<button disabled={settingWebhook} onClick={configureReception} className="ml-3 mt-3 rounded-md border border-current px-4 py-2 font-semibold disabled:opacity-50">{settingWebhook ? "Configurando…" : "Configurar recepción de mensajes"}</button>{webhookNotice && <p role="status" className="mt-2">{webhookNotice}</p>}</div>}
    {connectionResult && <p role="status" className="mb-4 text-sm text-ink">{connectionResult === "connected" ? "La autorización se guardó correctamente." : connectionResult === "webhook_pending" ? "La cuenta está autorizada. Falta completar la recepción de mensajes en Meta." : connectionResult === "cancelled" ? "La autorización fue cancelada. Podés volver a intentarlo." : connectionResult === "token_denied" ? "Meta no aceptó el código de autorización. Revisá la clave de la app conectada." : connectionResult === "token_expiry" ? "Meta no pudo extender la autorización. Volvé a autorizar la conexión." : connectionResult === "page_denied" ? "La página configurada no está entre las autorizadas para el CRM. Revisá la selección de páginas en Meta." : connectionResult === "instagram_missing" ? "La página autorizada no tiene una cuenta profesional de Instagram vinculada." : connectionResult === "messages_denied" ? "Meta autorizó la página, pero todavía no permite leer los mensajes de Instagram." : "No se pudo completar la autorización. Verificá que la cuenta elegida tenga acceso a la página y sus mensajes de Instagram."}</p>}
    {tab === "campaigns" && <MetaCampaignDashboard />}
    {tab === "messages" && inbox}
    {tab === "contacts" && <section className="rounded-lg border border-ink/15 bg-white p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-semibold text-ink">Contactos recibidos</h2><p className="mt-1 max-w-2xl text-sm text-ink/70">Formularios de Facebook e Instagram y personas que escriben por mensaje directo. Cada contacto conserva su propietario y su seguimiento en el CRM.</p></div><label className="block text-sm font-medium text-ink">Buscar contactos<input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Nombre, teléfono o correo" className="mt-1 block h-11 w-full rounded-md border border-ink/25 px-3 sm:w-72" /></label></div>
      {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
      <p className="mb-3 text-sm text-ink/70" aria-live="polite">{loading ? "Buscando contactos…" : `${data.total} contactos de Meta`}</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y border-ink/15 bg-cream-50 text-ink"><tr>{["Contacto", "Origen", "Desarrollo", "Propietario", "Estado", "Ingreso", "Acciones"].map(label => <th className="whitespace-nowrap px-3 py-3 font-semibold" key={label}>{label}</th>)}</tr></thead><tbody>
        {data.leads.map(lead => <tr key={lead.id} className="border-b border-ink/10 align-top"><td className="px-3 py-4"><Link href={`/admin/crm/${lead.id}`} className="font-semibold text-accent hover:underline">{lead.firstName} {lead.lastName === "-" ? "" : lead.lastName}</Link><span className="mt-1 block text-xs text-ink/70">{lead.email.includes("@sin-email.") ? "Sin correo informado" : lead.email}</span>{lead.phone && <span className="block text-xs text-ink/70">{lead.countryCode} {lead.phone}</span>}</td><td className="px-3 py-4">{lead.source || "Meta"}</td><td className="px-3 py-4">{lead.developmentName || "Sin desarrollo"}</td><td className="px-3 py-4">{lead.assignedAgentName || "Sin asignar"}</td><td className="px-3 py-4">{lead.status}</td><td className="whitespace-nowrap px-3 py-4">{new Date(lead.createdAt).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</td><td className="px-3 py-4"><Link href={`/admin/crm/${lead.id}`} className="block whitespace-nowrap text-accent hover:underline">Ver contacto</Link>{data.conversations?.[lead.id] && <Link href={`/admin/crm/marketing/whatsapp?lead=${lead.id}&channel=${data.conversations?.[lead.id]}`} className="mt-2 block whitespace-nowrap font-semibold text-accent hover:underline">Ver mensajes</Link>}</td></tr>)}
      </tbody></table></div>
      {!loading && !data.leads.length && <p className="py-12 text-center text-sm text-ink/70">{query ? "No hay contactos que coincidan con la búsqueda." : "Los contactos de formularios y mensajes de Meta aparecerán aquí cuando ingresen al CRM."}</p>}
      <div className="mt-4 flex items-center justify-between gap-3"><button disabled={loading || page === 1} onClick={() => setPage(p => p - 1)} className="rounded-md border border-ink/20 px-4 py-2 disabled:opacity-40">Anterior</button><span className="text-sm text-ink/70">Página {page} de {Math.max(1, Math.ceil(data.total / 25))}</span><button disabled={loading || page * 25 >= data.total} onClick={() => setPage(p => p + 1)} className="rounded-md border border-ink/20 px-4 py-2 disabled:opacity-40">Siguiente</button></div>
    </section>}
  </>;
}
