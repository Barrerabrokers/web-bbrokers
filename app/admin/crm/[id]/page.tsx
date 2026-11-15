import { MIA_RESERVATION_FIELDS, type MiaReservationField } from '@/lib/mia-reservation';
import { isCrmDevelopmentName } from "@/lib/crm-campaign";
import { getCrmOwnerHistory } from "@/lib/crm-owner-history";
import { CrmPurchaseHistory } from "@/components/admin/crm-purchase-history";
import { isInboundWhatsApp } from "@/lib/crm-whatsapp-history";
import { getCrmImportedInquiries } from "@/lib/crm-imported-inquiries";
import { CRM_LEAD_STATUS_OPTIONS } from "@/lib/crm-statuses";
import { CrmActivityEditor } from "@/components/admin/crm-activity-editor";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft, Building2, CalendarDays, Clock3, ExternalLink, FileSpreadsheet, GitBranch, Mail, MessageCircle, NotebookPen, Phone, Search } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getAllAgents, getCrmActivities, getCrmDataProperties, getCrmEmailTemplates, getCrmEmailTrackingsForLead, getCrmLeadById, type CrmActivity, type CrmLead } from "@/lib/db";
import { getDevelopments } from "@/lib/developments-db";
import { shouldShowHubSpotContactField } from "@/lib/hubspot-fields";
import { canManageListings, canViewAllCrmContacts } from "@/lib/roles";
import { CrmLeadFieldsEditor } from "@/components/admin/crm-lead-fields-editor";
import { CrmEmailComposer } from "@/components/admin/crm-email-composer";
import { CrmRepliesSync } from "@/components/admin/crm-replies-sync";
import { CrmMeetingScheduler } from "@/components/admin/crm-meeting-scheduler";
import { getMeetingLinkByAgent } from "@/lib/meeting-scheduler";
import { CrmContactHeader } from "@/components/admin/crm-contact-header";
import { CrmCallActivityAction } from "@/components/admin/crm-call-activity-action";
import { CrmContactAssistant } from "@/components/admin/crm-contact-assistant";
import { listWhatsAppMessagesForLead, type WhatsAppMessage } from "@/lib/whatsapp-inbox";
import { getCrmMetaFormSubmissions } from "@/lib/crm-meta-fields";
import { CrmMetaFormsSync } from "@/components/admin/crm-meta-forms-sync";
import { ARGENTINA_TIME_ZONE } from "@/lib/argentina-time";
import { CrmEmailFollowup } from "@/components/admin/crm-email-followup";
import { findTrackedEmailActivity } from "@/lib/crm-email-followup";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ACTIVITY_LABELS: Record<string, string> = { nota: "Nota", correo: "Correo", whatsapp: "WhatsApp", llamada: "Llamada", reunion: "Reunión", tarea: "Tarea" };
const ACTIVITY_TABS = [
  { value: "all", label: "Todas las actividades" }, { value: "nota", label: "Notas" }, { value: "correo", label: "Correos" },
  { value: "whatsapp", label: "WhatsApp" }, { value: "llamada", label: "Llamadas" }, { value: "tarea", label: "Tareas" },
  { value: "reunion", label: "Reuniones" },
];

function formatDate(value: string) { return new Intl.DateTimeFormat("es-AR", { timeZone: ARGENTINA_TIME_ZONE, dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function whatsappUrl(lead: CrmLead) {
  const digits = `${lead.countryCode}${lead.phone}`.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}
function formatHubSpotValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") return value.replaceAll("_", " ").replace(/\s+/g, " ").trim();
  if (["number", "boolean"].includes(typeof value)) return String(value);
  return JSON.stringify(value);
}
function formatHubSpotLabel(key: string) {
  const label = key.replaceAll("_", " ").replace(/\s+/g, " ").trim();
  return label ? label.charAt(0).toLocaleUpperCase("es-AR") + label.slice(1) : "Dato";
}
function usefulHubSpotFields(lead: CrmLead) {
  return Object.entries(lead.hubspotProperties || {}).map(([key, value]) => [key, formatHubSpotValue(value)] as const)
    .filter(([, value]) => value).filter(([key]) => shouldShowHubSpotContactField(key)).slice(0, 48);
}
function normalizeDevelopmentName(value = "") { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-AR").replace(/[^a-z0-9]+/g, " ").trim(); }

export default async function CrmLeadDetailPage({ params: pendingparams, searchParams: pendingsearchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ activity?: string; q?: string; email?: string }> }) {
  const params = await pendingparams;
  const searchParams = await pendingsearchParams;
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) {
    const query = new URLSearchParams();
    for (const key of ["activity", "q", "email"] as const) if (typeof searchParams?.[key] === "string") query.set(key, searchParams[key]);
    redirect(`/login?from=${encodeURIComponent(`/admin/crm/${params.id}${query.size ? `?${query}` : ""}`)}`);
  }
  const includeAll = canViewAllCrmContacts(session.user.role);
  const lead = await getCrmLeadById(params.id, { agentId: session.user.id, includeAll });
  if (!lead) notFound();
  const [activities, developments, agents, customDevelopments, templates, meetingLink, whatsappMessages, emailTrackings, occupations] = await Promise.all([
    getCrmActivities([lead.id]), getDevelopments(), includeAll ? getAllAgents() : Promise.resolve([]), getCrmDataProperties("development"),
    getCrmEmailTemplates(),
    getMeetingLinkByAgent(session.user.id),
    listWhatsAppMessagesForLead(lead.id, `${lead.countryCode}${lead.phone}`, null).catch(() => []),
    getCrmEmailTrackingsForLead(lead.id),
    getCrmDataProperties("occupation"),
  ]);
  const ownerHistory = await getCrmOwnerHistory(lead.id, session.user.role);
  const leadDevelopmentName = lead.developmentName || lead.developmentNameText || "";
  const mappedDevelopment = customDevelopments.find((property) => [property.value, property.label, property.hubspotValue, `text:${property.label}`].filter(Boolean).some((value) => value === lead.developmentId || normalizeDevelopmentName(value) === normalizeDevelopmentName(leadDevelopmentName)));
  const normalizedLeadDevelopment = normalizeDevelopmentName(leadDevelopmentName || mappedDevelopment?.localDevelopmentName);
  const selectedDevelopment = developments.find((development) => development.id === lead.developmentId || development.id === mappedDevelopment?.localDevelopmentId) || developments.find((development) => {
    const normalized = normalizeDevelopmentName(development.name);
    return Boolean(normalizedLeadDevelopment && (normalized === normalizedLeadDevelopment || normalized.includes(normalizedLeadDevelopment) || normalizedLeadDevelopment.includes(normalized)));
  });
  const developmentOptions = [
    ...customDevelopments.filter(property => property.active && isCrmDevelopmentName(property.localDevelopmentName || property.label) && !developments.some(d => d.id === property.localDevelopmentId || d.name.trim().toLowerCase() === (property.localDevelopmentName || property.label).trim().toLowerCase())).map(property => ({ id: property.localDevelopmentId || `text:${property.label}`, name: property.localDevelopmentName || property.label })),
    ...developments.map((development) => ({ id: development.id, name: development.name })),

  ];
  const waUrl = whatsappUrl(lead);
  const focusedEmail = searchParams?.email
    ? emailTrackings.find(item => item.id === searchParams.email)
    : searchParams?.activity === "correo"
      ? emailTrackings.filter(item => item.lastOpenedAt).sort((a, b) => +new Date(b.lastOpenedAt!) - +new Date(a.lastOpenedAt!))[0]
      : undefined;
  const focusedEmailActivity = focusedEmail ? findTrackedEmailActivity(focusedEmail, activities) : undefined;
  const whatsappHistory = activities.filter((activity) => activity.type === "whatsapp");
  const emailHistory = activities
    .filter((activity) => activity.type === "correo" && /^Correo enviado:/i.test(activity.title))
    .map((activity) => {
      const subject = activity.title.replace(/^Correo enviado:\s*/i, "").trim();
      const trackingId = activity.externalId?.startsWith("email-tracking:") ? activity.externalId.slice("email-tracking:".length) : "";
      const tracking = emailTrackings.find((item) => item.id === trackingId) || emailTrackings.find((item) => item.subject.trim() === subject && Math.abs(new Date(item.createdAt).getTime() - new Date(activity.createdAt).getTime()) < 10 * 60 * 1000);
      return { ...activity, openCount: tracking?.openCount ?? 0 };
    });
  const meetingHistory = activities.filter((activity) => activity.type === "reunion").sort((a, b) => new Date(b.scheduledAt || b.createdAt).getTime() - new Date(a.scheduledAt || a.createdAt).getTime());
  const hubspotFields = usefulHubSpotFields(lead);
  const miaState = (lead.metaProperties?.crm_mia_sequence_v1 as unknown as {state?:{reservation?:Record<string,string>;selected?:{project:string;unit:string};reason?:string;stage?:string}})?.state;
  const miaReservation = miaState?.reservation;
  const showMiaReservation = miaReservation && (miaState?.stage === 'recopilacion_reserva' || miaState?.stage === 'seleccion_moneda' || miaState?.reason === 'reserva');
  const metaFormSubmissions = getCrmMetaFormSubmissions(lead.metaProperties);
  const importedInquiries = getCrmImportedInquiries(lead.metaProperties);
  const activityFilter = searchParams?.activity || "all";
  const activityQuery = (searchParams?.q || "").trim().toLocaleLowerCase("es-AR");
  const visibleActivities = activities.filter((activity) => {
    if (activityFilter !== "all" && activity.type !== activityFilter) return false;
    if (!activityQuery) return true;
    return `${activity.title} ${activity.body || ""} ${activity.createdByName || ""}`.toLocaleLowerCase("es-AR").includes(activityQuery);
  });

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[#f3f4f4] text-ink">
      <CrmContactAssistant
        canViewAll={includeAll}
        contactId={lead.id}
        buttonLabel="Analizar cliente"
        initialQuestion={`Prepará un resumen ejecutivo de ${lead.firstName} ${lead.lastName}. Evaluá su interés, actividad, desarrollo consultado, estado y señales disponibles para estimar la posibilidad de cerrar una operación. Indicá también el próximo paso comercial recomendado, sin inventar datos.`}
      />
      <div className="grid min-h-[calc(100vh-5rem)] gap-px bg-ink/10 xl:grid-cols-[320px_minmax(520px,1fr)_320px]">
        <aside className="min-w-0 bg-[#f3f4f4] p-3 lg:p-4">
          <section id="contact-summary" className="scroll-mt-20 rounded-xl bg-white p-4 ring-1 ring-ink/10">
            <Link href="/admin/crm" className="inline-flex min-h-9 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-ink transition-colors hover:bg-[#e7f4f2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b]"><ArrowLeft className="h-4 w-4" /> Contactos</Link>
            <CrmContactHeader lead={lead} whatsappUrl={waUrl} />
          </section>
          <div id="contact-information" className="mt-3">
            <CrmLeadFieldsEditor occupations={occupations.filter(property => property.active).map(property => ({value: property.value, label: property.label}))} lead={lead} canDelete={includeAll} developments={developmentOptions}
              agents={agents.filter((agent) => agent.active).map((agent) => ({ id: agent.id, name: agent.name, email: agent.email }))} canAssignOwner={includeAll} />

            {includeAll && <details className="mt-3 rounded-xl bg-white p-4 ring-1 ring-ink/10">
              <summary className="cursor-pointer text-sm font-semibold text-ink">Historial de propietarios ({ownerHistory.length})</summary>
              <p className="mt-2 text-xs text-ink/60">Solo administración. Registro permanente, sin edición ni eliminación.</p>
              <ol className="mt-3 divide-y divide-ink/10">{ownerHistory.map(entry => <li key={String(entry.id)} className="py-3 text-sm">
                <p className="font-medium text-ink">{entry.kind === "baseline" ? "Propietario al activar el historial" : entry.kind === "initial" ? "Asignación inicial" : "Cambio de propietario"}</p>
                <p className="mt-1 break-words text-ink/80">{entry.kind === "change" ? `${entry.previous_owner_name} → ` : ""}{entry.owner_name}</p>
                <p className="mt-1 text-xs text-ink/60">{formatDate(String(entry.recorded_at))} · {entry.actor_name}</p>
                {entry.kind === "baseline" && <p className="mt-1 text-xs text-ink/60">No acredita la asignación inicial ni cambios anteriores.</p>}
              </li>)}</ol>
            </details>}
          </div>
        </aside>

        <main className="min-w-0 bg-[#f3f4f4]">
          <nav className="sticky top-0 z-10 flex overflow-x-auto border-b border-ink/10 bg-white" aria-label="Secciones del contacto">
            <a href="#contact-information" className="inline-flex min-h-14 shrink-0 items-center px-5 text-sm font-medium text-ink/62 hover:bg-[#e7f4f2]">Información destacada</a>
            <a href={importedInquiries.length ? "#imported-inquiries" : metaFormSubmissions.length > 0 ? "#meta-form-information" : "#hubspot-information"} className="inline-flex min-h-14 shrink-0 items-center px-5 text-sm font-medium text-ink/62 hover:bg-[#e7f4f2]">Información</a>
            <a href="#activities" className="inline-flex min-h-14 shrink-0 items-center border-b-2 border-[#006b6b] px-5 text-sm font-semibold text-[#006b6b]">Actividades</a>
          </nav>
          <div className="space-y-5 p-4 lg:p-6">

            <section id="activities" className="rounded-xl bg-white p-5 ring-1 ring-ink/10 lg:p-6">
              <div className="flex gap-1 overflow-x-auto border-b border-ink/10" role="tablist" aria-label="Filtrar actividades">
                {ACTIVITY_TABS.map((tab) => {
                  const selected = tab.value === activityFilter;
                  return <Link key={tab.value} href={`/admin/crm/${lead.id}?activity=${tab.value}${activityQuery ? `&q=${encodeURIComponent(activityQuery)}` : ""}`} role="tab" aria-selected={selected} className={`inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm transition-colors ${selected ? "border-[#006b6b] font-semibold text-[#006b6b]" : "border-transparent font-medium text-ink/58 hover:text-ink"}`}>{tab.label}</Link>;
                })}
              </div>
      {activityFilter === "correo" && focusedEmail && <CrmEmailFollowup leadId={lead.id} emailId={focusedEmail.id} name={`${lead.firstName} ${lead.lastName}`.trim() || lead.email || "Cliente"}
        recipient={focusedEmail.recipientEmail} subject={focusedEmail.subject} body={focusedEmailActivity?.body}
        sentAt={focusedEmail.createdAt} openedAt={focusedEmail.lastOpenedAt} openCount={focusedEmail.openCount}
        canCall={Boolean(lead.phone?.replace(/\D/g, ""))} whatsappUrl={lead.phone?.replace(/\D/g, "") ? waUrl : ""} legacy={!searchParams?.email} />}
      {activityFilter === "correo" && searchParams?.email && !focusedEmail && <p role="status" className="m-4 rounded-lg border border-ink/15 bg-white p-4 text-sm text-ink/70">El correo de esta notificación ya no está disponible. Podés continuar el seguimiento desde la ficha de este cliente.</p>}
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <form className="relative w-full max-w-sm" action={`/admin/crm/${lead.id}`}><input type="hidden" name="activity" value={activityFilter} /><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/42" /><input name="q" defaultValue={searchParams?.q || ""} placeholder="Buscar actividades" className="h-11 w-full rounded-lg border border-ink/15 bg-white pl-10 pr-3 text-sm text-ink outline-none placeholder:text-ink/48 focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15" /></form>
                <div className="flex flex-col items-end gap-2"><span className="text-sm text-ink/52">{visibleActivities.length} de {activities.length} actividades</span><CrmRepliesSync leadId={lead.id} /></div>
              </div>
              <div id="activity-composer" className="scroll-mt-20">
              <CrmCallActivityAction key={`${lead.id}-${activityFilter}-${focusedEmail?.id || ""}`} activityType={ACTIVITY_TABS.some((tab) => tab.value === activityFilter) ? activityFilter as "all" | "nota" | "correo" | "whatsapp" | "llamada" | "tarea" | "reunion" : "all"} leadId={lead.id} whatsappUrl={waUrl}
                initialTitle={activityFilter === "tarea" && focusedEmail ? `Seguimiento: ${focusedEmail.subject || "correo abierto"}` : ""}
                initialBody={activityFilter === "tarea" && focusedEmail ? `Contactar al cliente por el correo «${focusedEmail.subject || "Sin asunto"}», enviado el ${formatDate(focusedEmail.createdAt)}.${focusedEmail.lastOpenedAt ? ` Última apertura registrada: ${formatDate(focusedEmail.lastOpenedAt)}.` : ""}\nRegistrar el resultado y el próximo paso.` : ""} />
              </div>
              <div className="relative mt-6 space-y-3 before:absolute before:bottom-4 before:left-[17px] before:top-4 before:w-px before:bg-ink/12">
                {visibleActivities.map((activity) => <div key={activity.id} className="relative pl-12"><span className="absolute left-0 top-4 z-[1] flex h-9 w-9 items-center justify-center rounded-full bg-[#006b6b] text-white ring-4 ring-white"><ActivityIcon type={activity.type} /></span><ActivityCard activity={activity} /></div>)}
                {visibleActivities.length === 0 && <div className="relative rounded-lg border border-dashed border-ink/15 px-5 py-10 text-center"><NotebookPen className="mx-auto h-8 w-8 text-ink/28" /><p className="mt-3 text-sm font-medium text-ink">No encontramos actividades</p><p className="mt-1 text-sm text-ink/55">Probá otro filtro o una búsqueda diferente.</p></div>}
              </div>
            </section>
            {importedInquiries.length > 0 && <section id="imported-inquiries" className="scroll-mt-20 rounded-xl bg-white p-5 ring-1 ring-ink/10 lg:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-[#006b6b]">Información importada desde Excel</h2><span className="rounded-full bg-[#e7f4f2] px-3 py-1 text-xs font-semibold text-[#006b6b]">{importedInquiries.length} {importedInquiries.length === 1 ? "registro" : "registros"}</span></div>
              <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <InfoRow label="Propietario actual" value={lead.assignedAgentName || "Sin asignar"} />
                <InfoRow label="Estado actual" value={CRM_LEAD_STATUS_OPTIONS.find(option=>option.value===lead.status)?.label || lead.status} />
                <InfoRow label="Desarrollo" value={leadDevelopmentName || "Sin desarrollo"} /><InfoRow label="Campaña" value={lead.campaignName || "Sin campaña informada"} />
              </dl>
              {importedInquiries.map((inquiry,index)=><div key={`${inquiry.row}-${index}`} className="mt-5 border-t border-ink/10 pt-4">
                {inquiry.section && <p className="mb-3 text-sm font-semibold text-ink">{inquiry.section}</p>}
                <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  <InfoRow label="Origen de la consulta" value={inquiry.origin} />
                  {inquiry.fields.map((field,fieldIndex)=><InfoRow key={`${field.label}-${fieldIndex}`} label={field.label} value={field.value}/>)}
                </dl>
                <p className="mt-3 text-xs text-ink/70">Fuente: {inquiry.file || "Excel importado"}{inquiry.importedAt && !Number.isNaN(Date.parse(inquiry.importedAt)) ? ` · Importado el ${formatDate(inquiry.importedAt)}` : ""}</p>
              </div>)}
            </section>}

            {hubspotFields.length > 0 && <section id="hubspot-information" className="rounded-xl bg-white p-5 ring-1 ring-ink/10 lg:p-6"><h2 className="text-lg font-semibold tracking-tight text-ink">Información comercial importada</h2><dl className="mt-5 grid gap-x-8 gap-y-4 md:grid-cols-2">{hubspotFields.map(([key, value]) => <InfoRow key={key} label={formatHubSpotLabel(key)} value={value} />)}</dl></section>}
            {showMiaReservation && <section className="rounded-xl bg-white p-5 ring-1 ring-ink/10 lg:p-6"><h2 className="text-lg font-semibold tracking-tight text-ink">Solicitud de reserva · Mía</h2><p className="mt-2 text-sm text-ink/70">{miaState?.selected?.project} · Unidad {miaState?.selected?.unit}. Pendiente de revisión y aceptación del equipo. Los datos bancarios los informa un administrador.</p><dl className="mt-5 grid gap-x-8 gap-y-4 md:grid-cols-2">{(Object.keys(MIA_RESERVATION_FIELDS) as MiaReservationField[]).map(key => <InfoRow key={key} label={MIA_RESERVATION_FIELDS[key]} value={miaReservation?.[key] || "Pendiente"} />)}<InfoRow label="Moneda de preferencia" value={miaReservation?.currency === "ARS" ? "Pesos argentinos" : miaReservation?.currency === "USD" ? "Dólares estadounidenses" : "Pendiente"} /></dl></section>}
            <CrmPurchaseHistory key={`${lead.id}-${lead.metaProperties?.sales_import_pilot_v1 || ""}`} leadId={lead.id} value={lead.metaProperties?.sales_import_pilot_v1} canEdit={session.user.role === "admin"} developmentNames={Array.from(new Set(developments.map(item => item.name)))} />
            {metaFormSubmissions.length > 0 && <section id="meta-form-information" className="rounded-xl bg-white p-5 ring-1 ring-ink/10 lg:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold tracking-tight text-ink">Respuestas de formularios</h2><span className="mt-2 inline-flex rounded-full bg-[#e7f4f2] px-3 py-1 text-xs font-semibold text-[#006b6b]">{metaFormSubmissions.length} {metaFormSubmissions.length === 1 ? "formulario" : "formularios"}</span></div><CrmMetaFormsSync leadId={lead.id} /></div><div className="mt-5 space-y-4">{metaFormSubmissions.map((submission, index) => <article key={submission.leadId || `${submission.formId}-${index}`} className="rounded-xl border border-ink/10 bg-[#fafafa] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-ink">{submission.formName || `Formulario ${index + 1}`}</h3>{submission.createdTime && <time className="text-xs font-medium text-ink/48">{formatDate(submission.createdTime)}</time>}</div><dl className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2">{submission.fields.map((field) => <InfoRow key={field.key} label={field.label} value={field.value} />)}</dl></article>)}</div></section>}
          </div>
        </main>

        <aside className="space-y-4 bg-[#f3f4f4] p-4 lg:p-5">
          <WhatsAppHistoryPanel messages={whatsappMessages} activities={whatsappHistory} href={waUrl} />
          <CrmEmailComposer currentAgentId={session.user.id} lead={lead} templates={templates} history={emailHistory} />
          <CrmMeetingScheduler lead={lead} link={meetingLink} meetings={meetingHistory} />
          <ActionPanel icon={<GitBranch className="h-5 w-5" />} title="Workflows" description="Automatizá próximos pasos para este contacto." href="/admin/crm/workflows" action="Ver workflows" />
          <DevelopmentPanel name={lead.developmentName || lead.developmentNameText || "Todavía no se definió un desarrollo."} development={selectedDevelopment} />
        </aside>
      </div>
    </div>
  );
}

function WhatsAppHistoryPanel({ messages, activities, href }: { messages: WhatsAppMessage[]; activities: CrmActivity[]; href: string }) {
  const activityMessages = activities.filter((activity) => activity.body.trim()).filter((activity) => !messages.some((message) => Boolean(activity.externalId && message.whatsappMessageId === activity.externalId))).map((activity) => ({
    id: `activity-${activity.id}`,
    content: activity.body,
    direction: isInboundWhatsApp(activity.title, activity.externalSource) ? "inbound" as const : "outbound" as const,
    createdAt: activity.scheduledAt || activity.createdAt,
  }));
  const history = [...messages.map((message) => ({ id: message.id, content: message.content, direction: message.direction, createdAt: message.createdAt })), ...activityMessages]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return <section className="rounded-xl bg-white p-5 ring-1 ring-ink/10"><div className="flex items-center justify-between gap-3 border-b border-ink/10 pb-4"><span className="flex items-center gap-3 text-[#006b6b]"><MessageCircle className="h-5 w-5" /><h2 className="text-base font-semibold text-ink">Conversación de WhatsApp</h2></span><span className="text-xs font-medium text-ink/50">{history.length}</span></div>{history.length ? <ol className="mt-3 max-h-[600px] space-y-2 overflow-y-auto" aria-label="Historial registrado de WhatsApp">{history.map((message) => <li key={message.id} className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-lg px-3 py-2 ${message.direction === "outbound" ? "bg-[#e7f4f2] text-[#064f4f]" : "bg-[#f3f4f4] text-ink"}`}><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p><time className="mt-1 block text-[10px] font-medium opacity-55">{new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt))}</time></div></li>)}</ol> : <p className="mt-4 text-sm leading-relaxed text-ink/60">Todavía no hay mensajes registrados con este contacto.</p>}{href && <a href={href} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border border-[#006b6b] px-4 text-sm font-medium text-[#006b6b] transition-colors hover:bg-[#e7f4f2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b] focus-visible:ring-offset-2">Abrir WhatsApp</a>}</section>;
}

function ActionPanel({ icon, title, description, href, action, external }: { icon: ReactNode; title: string; description: string; href?: string; action: string; external?: boolean }) {
  return <section className="rounded-xl bg-white p-5 ring-1 ring-ink/10"><div className="flex items-center gap-3 border-b border-ink/10 pb-4 text-[#006b6b]">{icon}<h2 className="text-base font-semibold text-ink">{title}</h2></div><p className="mt-4 text-sm leading-relaxed text-ink/62">{description}</p>{href && <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border border-[#006b6b] px-4 text-sm font-medium text-[#006b6b] transition-colors hover:bg-[#e7f4f2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b] focus-visible:ring-offset-2">{action}</a>}</section>;
}
function DevelopmentPanel({ name, development }: { name: string; development?: { id: string; slug: string; brochureUrl?: string; priceListUrl?: string } }) {
  return <section className="rounded-xl bg-white p-5 ring-1 ring-ink/10"><div className="flex items-center gap-3 border-b border-ink/10 pb-4 text-[#006b6b]"><Building2 className="h-5 w-5" /><h2 className="text-base font-semibold text-ink">Desarrollo</h2></div><p className="mt-4 text-sm font-semibold leading-relaxed text-ink">{name}</p>{development ? <div className="mt-4 grid gap-2">{development.brochureUrl && <a href={development.brochureUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center justify-between gap-2 rounded-lg border border-[#006b6b] px-4 text-sm font-medium text-[#006b6b] hover:bg-[#e7f4f2]"><span className="inline-flex items-center gap-2"><ExternalLink className="h-4 w-4" />Abrir brochure</span></a>}{development.priceListUrl && <a href={`/api/developments/${development.id}/price-list`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center justify-between gap-2 rounded-lg border border-[#006b6b] px-4 text-sm font-medium text-[#006b6b] hover:bg-[#e7f4f2]"><span className="inline-flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" />Lista de precios</span></a>}<Link href={`/desarrollos/${development.slug}`} target="_blank" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-ink/70 hover:bg-[#f3f4f4]"><Building2 className="h-4 w-4" />Ver ficha del desarrollo</Link>{!development.brochureUrl && !development.priceListUrl && <p className="rounded-lg bg-[#f3f4f4] px-3 py-3 text-xs leading-relaxed text-ink/60">Este desarrollo todavía no tiene brochure ni lista de precios cargados.</p>}</div> : <p className="mt-3 text-xs leading-relaxed text-ink/60">No hay un desarrollo vinculado.</p>}</section>;
}
function ActivityIcon({ type }: { type: string }) {
  if (type === "correo") return <Mail className="h-4 w-4" />;
  if (type === "whatsapp") return <MessageCircle className="h-4 w-4" />;
  if (type === "llamada") return <Phone className="h-4 w-4" />;
  if (type === "reunion") return <CalendarDays className="h-4 w-4" />;
  return <NotebookPen className="h-4 w-4" />;
}
function ActivityCard({ activity }: { activity: CrmActivity }) {
  return <article className="rounded-xl bg-white p-4 ring-1 ring-ink/10"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-sm font-semibold text-ink">{activity.title}</p><p className="mt-1 text-xs text-ink/50">{ACTIVITY_LABELS[activity.type] || activity.type}{activity.createdByName ? ` · ${activity.createdByName}` : ""}</p></div><span className="inline-flex items-center gap-1 text-xs text-ink/45"><Clock3 className="h-3.5 w-3.5" />{formatDate(activity.createdAt)}</span></div>{activity.scheduledAt && <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#006b6b]"><CalendarDays className="h-3.5 w-3.5" />Programado: {formatDate(activity.scheduledAt)}</p>}{activity.body && <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-ink/68">{activity.body}</p>}<CrmActivityEditor activity={activity} /></article>;
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-ink/8 pb-3"><dt className="text-xs font-medium capitalize text-ink/48">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-ink [overflow-wrap:anywhere]">{value}</dd></div>;
}
