"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, BarChart3, CircleAlert, Eye, ListFilter, LockKeyhole, Mail, MessageCircle, MonitorSmartphone, MousePointerClick, Search, Send, UsersRound } from "lucide-react";
import type { ClientCampaignReport, ClientCampaignSummary, ClientInput, ClientLeadStatus, ClientList, PrivateClient } from "@/lib/crm-clients";
import type { CrmEmailTemplate } from "@/lib/db";

const field = "mt-1 w-full rounded-lg border border-ink/25 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[#006b6b]";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ink/20 px-4 text-sm font-semibold hover:bg-[#e7f4f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b] disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${button} border-[#006b6b] bg-[#006b6b] text-white hover:bg-[#004949]`;

async function jsonRequest(url: string, body?: unknown) {
  const response = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "No se pudo completar la operación.");
  return data;
}

type Batch = {
  listName: string;
  recipients: Array<{ id: string; name: string; email: string }>;
  campaignId: string;
  template: CrmEmailTemplate;
};

function rate(value:number,total:number){return total?Math.round(value/total*100):0;}
function formatDate(value:string|null){return value?new Intl.DateTimeFormat("es-AR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Argentina/Buenos_Aires"}).format(new Date(value)):"—";}

export function CrmClients() {
  const [clients, setClients] = useState<PrivateClient[]>([]);
  const [lists, setLists] = useState<ClientList[]>([]);
  const [leadStatuses, setLeadStatuses] = useState<ClientLeadStatus[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<CrmEmailTemplate[]>([]);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedList, setSelectedList] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [importConfirmed, setImportConfirmed] = useState(false);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [batchConfirmation, setBatchConfirmation] = useState("");
  const [editingClient, setEditingClient] = useState<ClientInput | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [campaigns,setCampaigns]=useState<ClientCampaignSummary[]>([]);
  const [selectedCampaign,setSelectedCampaign]=useState("");
  const [campaignReport,setCampaignReport]=useState<ClientCampaignReport|null>(null);
  const [reportLoading,setReportLoading]=useState(false);
  const [campaignFilter,setCampaignFilter]=useState<"all"|"delivered"|"notDelivered"|"bounced"|"opened"|"replied">("all");

  const activeList = useMemo(() => lists.find((list) => list.name === selectedList), [lists, selectedList]);
  const activeTemplate = useMemo(() => emailTemplates.find((template) => template.id === selectedTemplate), [emailTemplates, selectedTemplate]);
  const visibleCampaignContacts = useMemo(() => (campaignReport?.contacts || []).filter(contact => {
    if(campaignFilter === "delivered") return contact.status === "sent";
    if(campaignFilter === "notDelivered") return contact.status === "uncertain" || contact.status === "sending" || contact.status === "bounced";
    if(campaignFilter === "bounced") return contact.status === "bounced";
    if(campaignFilter === "opened") return contact.openCount > 0;
    if(campaignFilter === "replied") return Boolean(contact.repliedAt);
    return true;
  }), [campaignReport, campaignFilter]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    jsonRequest(`/api/crm/clients?q=${encodeURIComponent(query)}&page=${page}&list=${encodeURIComponent(selectedList)}`)
      .then((data) => {
        if (!active) return;
        setClients(data.clients || []);
        setHasMore(Boolean(data.hasMore));
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [page, query, refresh, selectedList]);

  useEffect(() => {
    let active = true;
    Promise.all([jsonRequest("/api/crm/clients?statuses=1"), jsonRequest("/api/crm/clients?templates=1"), jsonRequest("/api/crm/clients?lists=1")])
      .then(([statusData, templateData, listData]) => {
        if (!active) return;
        setLeadStatuses(statusData.statuses || []);
        setEmailTemplates(templateData.templates || []);
        setLists(listData.lists || []);
      })
      .catch((requestError) => active && setError(requestError.message));
    return () => { active = false; };
  }, [refresh]);

  useEffect(()=>{
    let active=true;
    jsonRequest("/api/crm/clients/report").then(data=>{if(active){
      const nextCampaigns:ClientCampaignSummary[]=data.campaigns||[];
      setCampaigns(nextCampaigns);
      setSelectedCampaign(current=>nextCampaigns.some(campaign=>campaign.campaignId===current)?current:(nextCampaigns[0]?.campaignId||""));
    }}).catch(requestError=>active&&setError(requestError.message));
    return()=>{active=false;};
  },[refresh]);

  useEffect(()=>{
    if(!selectedCampaign){setCampaignReport(null);return;}
    setCampaignFilter("all");
    let active=true;setReportLoading(true);
    jsonRequest(`/api/crm/clients/report?campaignId=${encodeURIComponent(selectedCampaign)}`).then(data=>{if(active)setCampaignReport(data.report||null);}).catch(requestError=>active&&setError(requestError.message)).finally(()=>active&&setReportLoading(false));
    return()=>{active=false;};
  },[selectedCampaign,refresh]);

  async function createList(event: FormEvent) {
    event.preventDefault();
    if (!selectedStatus || !importConfirmed || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await jsonRequest("/api/crm/clients", { action: "import-status", status: selectedStatus, confirmed: true });
      setSelectedList(selectedStatus);
      setImportConfirmed(false);
      setPage(0);
      setRefresh((value) => value + 1);
      setNotice(`Lista «${selectedStatus}» actualizada: ${data.added} contactos nuevos y ${data.updated || 0} actualizados. No se modificó ningún lead, propietario ni estado.`);
    } catch (requestError) { setError((requestError as Error).message); }
    finally { setBusy(false); }
  }

  async function prepareList() {
    if (!selectedList || !activeTemplate || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await jsonRequest(`/api/crm/clients?recipients=1&list=${encodeURIComponent(selectedList)}`);
      const recipients = data.recipients || [];
      if (!recipients.length) throw new Error("La lista no tiene contactos con correo autorizado para enviar.");
      setBatch({ listName: selectedList, recipients, campaignId: crypto.randomUUID(), template: activeTemplate });
      setBatchConfirmation("");
    } catch (requestError) { setError((requestError as Error).message); }
    finally { setBusy(false); }
  }

  async function sendList(event: FormEvent) {
    event.preventDefault();
    if (!batch || batchConfirmation !== batch.listName || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await jsonRequest("/api/crm/clients/send-list", { listName: batch.listName, campaignId: batch.campaignId, templateId: batch.template.id, confirmed: true, confirmList: batchConfirmation });
      setBatch(null); setBatchConfirmation(""); setRefresh((value) => value + 1);
      setNotice(`Campaña «${batch.listName}» programada para ${data.queued} contactos. El CRM continuará enviándola en segundo plano; podés cerrar esta pestaña sin interrumpirla.`);
    } catch (requestError) { setError((requestError as Error).message); }
    finally { setBusy(false); }
  }

  async function saveClient(event: FormEvent) {
    event.preventDefault();
    if (!editingClient || busy) return;
    setBusy(true); setError("");
    try {
      await jsonRequest("/api/crm/clients", editingClient);
      setEditingClient(null); setRefresh((value) => value + 1);
      setNotice("Preferencias de correo actualizadas. El lead y su propietario no cambiaron.");
    } catch (requestError) { setError((requestError as Error).message); }
    finally { setBusy(false); }
  }

  async function markEmailInvalid(clientId:string,email:string) {
    if(busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await jsonRequest("/api/crm/clients", { action:"mark-email-invalid", id:clientId, reason:"Marcado como inválido desde el informe de campaña." });
      setRefresh(value=>value+1);
      setNotice(`${email} quedó marcado como inválido y fue excluido de campañas futuras.`);
    } catch(requestError) { setError((requestError as Error).message); }
    finally { setBusy(false); }
  }

  if (batch) return <section className="mx-auto max-w-4xl py-6">
    <button type="button" className={button} disabled={busy} onClick={() => setBatch(null)}><ArrowLeft className="h-4 w-4"/>Volver</button>
    <form onSubmit={sendList} className="mt-5 rounded-xl bg-white p-5 ring-1 ring-ink/15 sm:p-6">
      <h2 className="text-xl font-semibold text-ink">Confirmar correo de marketing</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/80">Se enviará la plantilla guardada sin permitir cambios desde esta pantalla. Cada destinatario quedará registrado en el historial.</p>
      <dl className="mt-5 grid gap-4 rounded-lg bg-[#f2f8f7] p-4 text-sm sm:grid-cols-2">
        <div><dt className="font-medium text-ink/70">Lista</dt><dd className="mt-1 font-semibold">{batch.listName}</dd></div>
        <div><dt className="font-medium text-ink/70">Destinatarios</dt><dd className="mt-1 font-semibold">{batch.recipients.length}</dd></div>
        <div><dt className="font-medium text-ink/70">Plantilla</dt><dd className="mt-1 font-semibold">{batch.template.name}</dd></div>
        <div><dt className="font-medium text-ink/70">Asunto</dt><dd className="mt-1 font-semibold">{batch.template.subject}</dd></div>
      </dl>
      <label className="mt-5 block text-sm font-medium">Escribí exactamente «{batch.listName}» para confirmar<input required className={field} value={batchConfirmation} onChange={(event) => setBatchConfirmation(event.target.value)}/></label>
      <p className="mt-3 text-sm text-ink/75">Para cambiar contenido, imágenes o enlaces, editá la plantilla en la sección Plantillas antes de enviar.</p>
      <button className={`${primary} mt-5`} disabled={busy || batchConfirmation !== batch.listName}><Send className="h-4 w-4"/>{busy ? "Enviando…" : `Enviar a ${batch.recipients.length} contactos`}</button>
    </form>
  </section>;

  return <section className="mx-auto max-w-6xl py-6">
    <header>
      <h2 className="text-2xl font-semibold text-ink">Correos de Marketing</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink/80">Creá listas desde el Estado del Lead y enviá a todos sus contactos una plantilla de correo ya guardada.</p>
      <p className="mt-3 flex items-center gap-2 text-sm text-[#006b6b]"><LockKeyhole className="h-4 w-4"/>Solo los administradores pueden ver listas, destinatarios e historial de envíos.</p>
    </header>

    {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mt-5 rounded-lg bg-[#e7f4f2] p-4 text-sm text-[#004949]">{notice}</p>}

    <section className="mt-6 grid gap-5 lg:grid-cols-2">
      <div className="rounded-xl border border-ink/15 bg-white p-5">
        <div className="flex gap-3"><UsersRound className="mt-0.5 h-5 w-5 shrink-0 text-[#006b6b]"/><div><h3 className="font-semibold">1. Crear una lista por Estado del Lead</h3><p className="mt-1 text-sm leading-relaxed text-ink/75">Por ejemplo, elegí «Vendido». El contacto se agrega a esa lista sin cambiar el estado, el propietario ni ningún dato del lead.</p></div></div>
        <form onSubmit={createList} className="mt-4 space-y-3">
          <label className="block text-sm font-medium">Estado del Lead<select className={field} value={selectedStatus} onChange={(event) => { setSelectedStatus(event.target.value); setImportConfirmed(false); }}><option value="">Elegí un estado</option>{leadStatuses.map((status) => <option key={status.status} value={status.status}>{status.status} — {status.eligible} contactos</option>)}</select></label>
          <label className="flex items-start gap-3 text-sm leading-relaxed"><input required type="checkbox" checked={importConfirmed} onChange={(event) => setImportConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-[#006b6b]"/><span>Confirmo que los contactos de esta lista están autorizados a recibir correos de marketing.</span></label>
          <button disabled={busy || !selectedStatus || !importConfirmed} className={primary}><ListFilter className="h-4 w-4"/>{busy ? "Actualizando…" : "Crear o actualizar lista"}</button>
        </form>
      </div>

      <div className="rounded-xl border border-ink/15 bg-white p-5">
        <div className="flex gap-3"><Mail className="mt-0.5 h-5 w-5 shrink-0 text-[#006b6b]"/><div><h3 className="font-semibold">2. Elegir lista y plantilla</h3><p className="mt-1 text-sm leading-relaxed text-ink/75">El correo se enviará tal como fue diseñado en Plantillas. Desde aquí no se puede redactar ni modificar.</p></div></div>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium">Lista de destinatarios<select className={field} value={selectedList} onChange={(event) => { setSelectedList(event.target.value); setPage(0); }}><option value="">Elegí una lista</option>{lists.map((list) => <option key={list.name} value={list.name}>{list.name} — {list.emailReady} contactos con correo</option>)}</select></label>
          <label className="block text-sm font-medium">Plantilla guardada<select className={field} value={selectedTemplate} onChange={(event) => setSelectedTemplate(event.target.value)}><option value="">Elegí una plantilla</option>{emailTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
          <div className="flex flex-wrap items-center gap-3 pt-1"><button type="button" className={primary} disabled={busy || !selectedList || !selectedTemplate || !activeList?.emailReady} onClick={prepareList}><Mail className="h-4 w-4"/>{busy ? "Preparando…" : "Preparar envío a la lista"}</button><Link href="/admin/crm/plantillas" className="text-sm font-semibold text-[#006b6b] underline underline-offset-4">Ver plantillas</Link></div>
        </div>
      </div>
    </section>

    <section className="mt-7 rounded-xl bg-white p-5 ring-1 ring-ink/15 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><BarChart3 className="mt-0.5 h-5 w-5 text-[#006b6b]"/><div><h3 className="text-lg font-semibold">Informe de campañas</h3><p className="mt-1 max-w-2xl text-sm text-ink/75">El informe muestra únicamente envíos confirmados. Las precargas automáticas de privacidad se separan y no cuentan como aperturas. Un clic confirma interacción y permite identificar mejor el dispositivo.</p></div></div>{campaigns.length>0&&<label className="min-w-64 text-sm font-medium">Campaña<select className={field} value={selectedCampaign} onChange={event=>setSelectedCampaign(event.target.value)}>{campaigns.map(campaign=><option key={campaign.campaignId} value={campaign.campaignId}>{campaign.listName} · {formatDate(campaign.sentAt)}</option>)}</select></label>}</div>
      {reportLoading?<p className="py-10 text-sm text-ink/70">Actualizando informe…</p>:!campaignReport?<div className="py-10 text-center"><p className="font-semibold">Todavía no hay campañas enviadas</p><p className="mt-2 text-sm text-ink/70">El informe aparecerá después del primer envío a una lista.</p></div>:<>
        <div className="mt-6 grid gap-px overflow-hidden rounded-lg bg-ink/10 sm:grid-cols-5">
          {[{label:"Entregados",value:campaignReport.summary.sent,detail:"aceptados por el servidor",icon:Mail},{label:"No entregados",value:campaignReport.summary.notDelivered,detail:"incluye rebotes y pendientes",icon:CircleAlert},{label:"Rebotados",value:campaignReport.summary.bounced,detail:"se excluyen de marketing",icon:CircleAlert},{label:"Abiertos",value:campaignReport.summary.opened,detail:`${rate(campaignReport.summary.opened,campaignReport.summary.sent)}% de entregados`,icon:Eye},{label:"Respuestas",value:campaignReport.summary.replied,detail:"registradas en el CRM",icon:MessageCircle}].map(metric=>{const Icon=metric.icon;return <div key={metric.label} className="bg-[#f7faf9] p-4"><Icon className="h-4 w-4 text-[#006b6b]"/><p className="mt-3 text-2xl font-semibold">{metric.value}</p><p className="mt-1 text-xs font-medium text-ink/70">{metric.label}</p><p className="mt-1 text-xs text-ink/55">{metric.detail}</p></div>;})}
        </div>
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Filtrar resultados de la campaña">{([['all','Todos'],['delivered','Entregados'],['notDelivered','No entregados'],['bounced','Rebotados'],['opened','Abiertos'],['replied','Respondieron']] as const).map(([value,label])=><button key={value} type="button" onClick={()=>setCampaignFilter(value)} className={`${campaignFilter===value?primary:button} min-h-9 px-3`}>{label}{value==='all'?` (${campaignReport.contacts.length})`:value==='delivered'?` (${campaignReport.summary.sent})`:value==='notDelivered'?` (${campaignReport.summary.notDelivered})`:value==='bounced'?` (${campaignReport.summary.bounced})`:value==='opened'?` (${campaignReport.summary.opened})`:` (${campaignReport.summary.replied})`}</button>)}</div>
        <div className="mt-4 overflow-x-auto rounded-lg ring-1 ring-ink/15"><table className="w-full min-w-[1120px] text-left text-sm"><thead className="bg-[#f2f8f7]"><tr>{["Contacto","Estado de entrega","Interacción","Aperturas confirmadas","Dispositivo verificado","Clics","Respuesta","Propietario"].map(value=><th key={value} className="px-4 py-3 font-semibold">{value}</th>)}</tr></thead><tbody className="divide-y divide-ink/10">{visibleCampaignContacts.map((contact,index)=><tr key={contact.id}><td className="px-4 py-4"><div className="flex items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e7f4f2] text-xs font-semibold text-[#006b6b]">{index+1}</span><div><p className="font-semibold">{contact.name}</p><p className="mt-1 text-xs text-ink/60">{contact.email}</p>{contact.emailStatus==='invalid'&&<p className="mt-1 text-xs font-semibold text-red-700">Email inválido · excluido</p>}</div></div></td><td className="px-4 py-4">{contact.status==='sent'?<span className="font-semibold text-[#006b6b]">Entregado</span>:contact.status==='bounced'?<><span className="font-semibold text-red-700">Rebotado</span><p className="mt-1 max-w-56 text-xs text-red-700/80">{contact.error||"Dirección no disponible"}</p>{contact.emailStatus!=='invalid'&&<button type="button" disabled={busy} onClick={()=>markEmailInvalid(contact.clientId,contact.email)} className="mt-2 text-xs font-semibold text-red-700 underline underline-offset-2">Marcar email inválido</button>}</>:<><span className="font-semibold text-amber-800">No entregado</span><p className="mt-1 max-w-56 text-xs text-ink/55">{contact.status==='sending'?"En proceso":"Pendiente de reintento"}</p></>}</td><td className="px-4 py-4"><span className="rounded-full bg-[#e7f4f2] px-2.5 py-1 text-xs font-semibold text-[#005c5c]">{contact.score} puntos</span></td><td className="px-4 py-4"><p className="font-semibold">{contact.openCount}</p><p className="mt-1 text-xs text-ink/55">{formatDate(contact.firstOpenedAt)}</p></td><td className="px-4 py-4"><div className="flex items-start gap-2"><MonitorSmartphone className="mt-0.5 h-4 w-4 text-ink/50"/><div><p>{contact.deviceType}</p><p className="mt-1 text-xs text-ink/55">{contact.mailClient}{contact.privacyProtected?" · no verificable":""}</p></div></div></td><td className="px-4 py-4"><p className="font-semibold">{contact.clickCount}</p>{contact.clickedLinks.length>0&&<details className="mt-1"><summary className="cursor-pointer text-xs font-medium text-[#006b6b]">Ver enlaces</summary><ul className="mt-2 max-w-64 space-y-1">{contact.clickedLinks.map(link=><li key={link} className="truncate text-xs text-ink/60" title={link}>{link}</li>)}</ul></details>}</td><td className="px-4 py-4">{contact.repliedAt?<><span className="font-semibold text-[#006b6b]">Respondió</span><p className="mt-1 text-xs text-ink/55">{formatDate(contact.repliedAt)}</p></>:"Sin respuesta"}</td><td className="px-4 py-4">{contact.ownerName}</td></tr>)}</tbody></table>{visibleCampaignContacts.length===0&&<p className="p-6 text-center text-sm text-ink/65">No hay contactos en esta categoría.</p>}</div>
        <p className="mt-4 text-xs leading-relaxed text-ink/60">Los proveedores de correo no informan cuánto tiempo permanece abierto un mensaje; por eso no mostramos una duración que pueda ser engañosa. Las respuestas aparecen cuando la casilla conectada del agente se sincroniza con el CRM.</p>
      </>}
    </section>

    {editingClient && <section className="mt-6 rounded-xl bg-white p-5 ring-1 ring-ink/15">
      <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold">Preferencias de {editingClient.name}</h3><button type="button" className={button} disabled={busy} onClick={() => setEditingClient(null)}>Cerrar</button></div>
      <form onSubmit={saveClient} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Nombre<input required maxLength={200} className={field} value={editingClient.name} onChange={(event) => setEditingClient({ ...editingClient, name: event.target.value })}/></label>
        <label className="text-sm font-medium">Correo<input type="email" maxLength={254} className={field} value={editingClient.email} onChange={(event) => setEditingClient({ ...editingClient, email: event.target.value })}/></label>
        <label className="text-sm font-medium">Teléfono<input type="tel" maxLength={50} className={field} value={editingClient.phone} onChange={(event) => setEditingClient({ ...editingClient, phone: event.target.value })}/></label>
        <label className="flex items-start gap-3 rounded-lg bg-[#f2f8f7] p-4 text-sm sm:col-span-2"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#006b6b]" checked={editingClient.subscribed} disabled={editingClient.emailStatus==='invalid'} onChange={(event) => setEditingClient({ ...editingClient, subscribed: event.target.checked })}/><span>Puede recibir correos de marketing.<span className="mt-1 block text-ink/70">Desmarcá esta opción si solicita la baja.</span></span></label>
        <label className="flex items-start gap-3 rounded-lg bg-red-50 p-4 text-sm sm:col-span-2"><input type="checkbox" className="mt-1 h-4 w-4 accent-red-700" checked={editingClient.emailStatus==='invalid'} onChange={(event) => setEditingClient({ ...editingClient, emailStatus:event.target.checked?'invalid':'active', subscribed:event.target.checked?false:editingClient.subscribed })}/><span><span className="font-semibold text-red-800">El email no funciona o está desactualizado.</span><span className="mt-1 block text-red-800/80">Lo excluye de campañas actuales y futuras; el teléfono y la ficha del cliente se conservan.</span></span></label>
        <button className={primary} disabled={busy}>{busy ? "Guardando…" : "Guardar preferencias"}</button>
      </form>
    </section>}

    <section className="mt-7">
      <form onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); setPage(0); }} className="flex min-w-0 flex-wrap items-end gap-2">
        <label className="min-w-56 flex-1 text-sm font-medium">Buscar contactos<input className={field} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, correo o teléfono"/></label>
        <button className={button}><Search className="h-4 w-4"/>Buscar</button>
      </form>
      {loading ? <p role="status" className="py-10 text-sm text-ink/75">Cargando contactos…</p> : clients.length === 0 ? <div className="py-12 text-center"><h3 className="text-lg font-semibold">{selectedList ? "Esta lista todavía no tiene contactos" : "Creá o elegí una lista para comenzar"}</h3><p className="mx-auto mt-3 max-w-xl text-sm text-ink/75">Las listas se completan desde el Estado del Lead y se mantienen separadas de los datos comerciales del contacto.</p></div> : <div className="mt-5 overflow-x-auto rounded-lg bg-white ring-1 ring-ink/15">
        <table className="w-full text-left text-sm"><thead className="border-b border-ink/15 bg-[#f2f8f7]"><tr>{["Contacto", "Lista", "Estado del email", "Autorización", "Último envío", "Acciones"].map((value) => <th key={value} scope="col" className="px-4 py-3 font-semibold">{value}</th>)}</tr></thead><tbody className="divide-y divide-ink/10">{clients.map((client) => <tr key={client.id}><td className="max-w-xs px-4 py-4"><p className="font-semibold">{client.name}</p><p className="mt-1 break-all text-ink/75">{client.email || client.phone}</p></td><td className="px-4 py-4">{client.listName}</td><td className="px-4 py-4">{client.emailStatus==='invalid'?<span className="font-semibold text-red-700">Inválido / desactualizado</span>:"Activo"}</td><td className="px-4 py-4">{client.subscribed ? "Autorizado" : "No enviar"}</td><td className="whitespace-nowrap px-4 py-4">{client.lastSentAt ? new Date(client.lastSentAt).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : "Sin envíos"}</td><td className="px-4 py-3"><button type="button" className={button} onClick={() => setEditingClient({ id: client.id, name: client.name, email: client.email, phone: client.phone, purchase: client.purchase, notes: client.notes, subscribed: client.subscribed, emailStatus:client.emailStatus, leadId: client.leadId })}>Preferencias</button></td></tr>)}</tbody></table>
      </div>}
      <div className="mt-4 flex items-center justify-between gap-2"><button type="button" className={button} disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}>Anterior</button><span className="text-sm text-ink/75">Página {page + 1}</span><button type="button" className={button} disabled={!hasMore || loading} onClick={() => setPage((value) => value + 1)}>Siguiente</button></div>
    </section>
  </section>;
}
