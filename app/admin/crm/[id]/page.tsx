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

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ACTIVITY_LABELS: Record<string, string> = { nota: "Nota", correo: "Correo", whatsapp: "WhatsApp", llamada: "Llamada", reunion: "Reunión", tarea: "Tarea" };
const ACTIVITY_TABS = [
  { value: "all", label: "Todas las actividades" }, { value: "nota", label: "Notas" }, { value: "correo", label: "Correos" },
  { value: "whatsapp", label: "WhatsApp" }, { value: "llamada", label: "Llamadas" }, { value: "tarea", label: "Tareas" },
  { value: "reunion", label: "Reuniones" },
];

function formatDate(value: string) { return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function whatsappUrl(lead: CrmLead) {
  const digits = `${lead.countryCode}${lead.phone}`.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}
function formatHubSpotValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  return JSON.stringify(value);
}
function usefulHubSpotFields(lead: CrmLead) {
  return Object.entries(lead.hubspotProperties || {}).map(([key, value]) => [key, formatHubSpotValue(value)] as const)
    .filter(([, value]) => value).filter(([key]) => shouldShowHubSpotContactField(key)).slice(0, 48);
}
function normalizeDevelopmentName(value = "") { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-AR").replace(/[^a-z0-9]+/g, " ").trim(); }

export default async function CrmLeadDetailPage({ params, searchParams }: { params: { id: string }; searchParams?: { activity?: string; q?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) redirect(`/login?from=/admin/crm/${params.id}`);
  const includeAll = canViewAllCrmContacts(session.user.role);
  const lead = await getCrmLeadById(params.id, { agentId: session.user.id, includeAll });
  if (!lead) notFound();
  const [activities, developments, agents, customDevelopments, templates, meetingLink, whatsappMessages, emailTrackings] = await Promise.all([
    getCrmActivities([lead.id]), getDevelopments(), includeAll ? getAllAgents() : Promise.resolve([]), getCrmDataProperties("development"),
    getCrmEmailTemplates(),
    getMeetingLinkByAgent(lead.assignedAgentId || session.user.id),
    listWhatsAppMessagesForLead(lead.id, `${lead.countryCode}${lead.phone}`).catch(() => []),
    getCrmEmailTrackingsForLead(lead.id),
  ]);
  const leadDevelopmentName = lead.developmentName || lead.developmentNameText || "";
  const mappedDevelopment = customDevelopments.find((property) => [property.value, property.label, property.hubspotValue, `text:${property.label}`].filter(Boolean).some((value) => value === lead.developmentId || normalizeDevelopmentName(value) === normalizeDevelopmentName(leadDevelopmentName)));
  const normalizedLeadDevelopment = normalizeDevelopmentName(leadDevelopmentName || mappedDevelopment?.localDevelopmentName);
  const selectedDevelopment = developments.find((development) => development.id === lead.developmentId || development.id === mappedDevelopment?.localDevelopmentId) || developments.find((development) => {
    const normalized = normalizeDevelopmentName(development.name);
    return Boolean(normalizedLeadDevelopment && (normalized === normalizedLeadDevelopment || normalized.includes(normalizedLeadDevelopment) || normalizedLeadDevelopment.includes(normalized)));
  });
  const developmentOptions = [
    ...developments.map((development) => ({ id: development.id, name: development.name })),
    ...customDevelopments.filter((property) => property.active).map((property) => ({ id: property.localDevelopmentId || `text:${property.label}`, name: property.localDevelopmentName || property.label })),
  ];
  const waUrl = whatsappUrl(lead);
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
          <section className="rounded-xl bg-white p-4 ring-1 ring-ink/10">
            <Link href="/admin/crm" className="inline-flex min-h-9 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-ink transition-colors hover:bg-[#e7f4f2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b]"><ArrowLeft className="h-4 w-4" /> Contactos</Link>
            <CrmContactHeader lead={lead} whatsappUrl={waUrl} />
          </section>
          <div id="contact-information" className="mt-3">
            <CrmLeadFieldsEditor lead={lead} canDelete={includeAll} developments={developmentOptions}
              agents={agents.filter((agent) => agent.active).map((agent) => ({ id: agent.id, name: agent.name, email: agent.email }))} canAssignOwner={includeAll} />
          </div>
        </aside>

        <main className="min-w-0 bg-[#f3f4f4]">
          <nav className="sticky top-0 z-10 flex overflow-x-auto border-b border-ink/10 bg-white" aria-label="Secciones del contacto">
            <a href="#contact-information" className="inline-flex min-h-14 shrink-0 items-center px-5 text-sm font-medium text-ink/62 hover:bg-[#e7f4f2]">Información destacada</a>
            <a href="#hubspot-information" className="inline-flex min-h-14 shrink-0 items-center px-5 text-sm font-medium text-ink/62 hover:bg-[#e7f4f2]">Información</a>
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
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <form className="relative w-full max-w-sm" action={`/admin/crm/${lead.id}`}><input type="hidden" name="activity" value={activityFilter} /><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/42" /><input name="q" defaultValue={searchParams?.q || ""} placeholder="Buscar actividades" className="h-11 w-full rounded-lg border border-ink/15 bg-white pl-10 pr-3 text-sm text-ink outline-none placeholder:text-ink/48 focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15" /></form>
                <div className="flex flex-col items-end gap-2"><span className="text-sm text-ink/52">{visibleActivities.length} de {activities.length} actividades</span><CrmRepliesSync leadId={lead.id} /></div>
              </div>
              <CrmCallActivityAction activityType={ACTIVITY_TABS.some((tab) => tab.value === activityFilter) ? activityFilter as "all" | "nota" | "correo" | "whatsapp" | "llamada" | "tarea" | "reunion" : "all"} leadId={lead.id} whatsappUrl={waUrl} />
              <div className="relative mt-6 space-y-3 before:absolute before:bottom-4 before:left-[17px] before:top-4 before:w-px before:bg-ink/12">
                {visibleActivities.map((activity) => <div key={activity.id} className="relative pl-12"><span className="absolute left-0 top-4 z-[1] flex h-9 w-9 items-center justify-center rounded-full bg-[#006b6b] text-white ring-4 ring-white"><ActivityIcon type={activity.type} /></span><ActivityCard activity={activity} /></div>)}
                {visibleActivities.length === 0 && <div className="relative rounded-lg border border-dashed border-ink/15 px-5 py-10 text-center"><NotebookPen className="mx-auto h-8 w-8 text-ink/28" /><p className="mt-3 text-sm font-medium text-ink">No encontramos actividades</p><p className="mt-1 text-sm text-ink/55">Probá otro filtro o una búsqueda diferente.</p></div>}
              </div>
            </section>
            {hubspotFields.length > 0 && <section id="hubspot-information" className="rounded-xl bg-white p-5 ring-1 ring-ink/10 lg:p-6"><h2 className="text-lg font-semibold tracking-tight text-ink">Información importada de HubSpot</h2><dl className="mt-5 grid gap-x-8 gap-y-4 md:grid-cols-2">{hubspotFields.map(([key, value]) => <InfoRow key={key} label={key.replaceAll("_", " ")} value={value} />)}</dl></section>}
          </div>
        </main>

        <aside className="space-y-4 bg-[#f3f4f4] p-4 lg:p-5">
          <WhatsAppHistoryPanel messages={whatsappMessages} activities={whatsappHistory} href={waUrl} />
          <CrmEmailComposer lead={lead} templates={templates} history={emailHistory} />
          <CrmMeetingScheduler lead={lead} link={meetingLink} meetings={meetingHistory} />
          <ActionPanel icon={<GitBranch className="h-5 w-5" />} title="Workflows" description="Automatizá próximos pasos para este contacto." href="/admin/crm/workflows" action="Ver workflows" />
          <DevelopmentPanel name={lead.developmentName || lead.developmentNameText || "Todavía no se definió un desarrollo."} development={selectedDevelopment} />
        </aside>
      </div>
    </div>
  );
}

function WhatsAppHistoryPanel({ messages, activities, href }: { messages: WhatsAppMessage[]; activities: CrmActivity[]; href: string }) {
  const activityMessages = activities.filter((activity) => activity.body.trim()).filter((activity) => !messages.some((message) => message.content.trim() === activity.body.trim())).map((activity) => ({
    id: `activity-${activity.id}`,
    content: activity.body,
    direction: activity.externalSource === "whatsapp_inbound" || /^respuesta por whatsapp/i.test(activity.title) ? "inbound" as const : "outbound" as const,
    createdAt: activity.scheduledAt || activity.createdAt,
  }));
  const history = [...messages.map((message) => ({ id: message.id, content: message.content, direction: message.direction, createdAt: message.createdAt })), ...activityMessages]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return <section className="rounded-xl bg-white p-5 ring-1 ring-ink/10"><div className="flex items-center justify-between gap-3 border-b border-ink/10 pb-4"><span className="flex items-center gap-3 text-[#006b6b]"><MessageCircle className="h-5 w-5" /><h2 className="text-base font-semibold text-ink">Conversación de WhatsApp</h2></span><span className="text-xs font-medium text-ink/50">{history.length}</span></div>{history.length ? <ol className="mt-3 space-y-2">{history.slice(-4).map((message) => <li key={message.id} className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-lg px-3 py-2 ${message.direction === "outbound" ? "bg-[#e7f4f2] text-[#064f4f]" : "bg-[#f3f4f4] text-ink"}`}><p className="line-clamp-3 break-words text-xs leading-relaxed">{message.content}</p><time className="mt-1 block text-[10px] font-medium opacity-55">{new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt))}</time></div></li>)}</ol> : <p className="mt-4 text-sm leading-relaxed text-ink/60">Todavía no hay mensajes registrados con este contacto.</p>}{href && <a href={href} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border border-[#006b6b] px-4 text-sm font-medium text-[#006b6b] transition-colors hover:bg-[#e7f4f2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b] focus-visible:ring-offset-2">Abrir WhatsApp</a>}</section>;
}

function ActionPanel({ icon, title, description, href, action, external }: { icon: ReactNode; title: string; description: string; href?: string; action: string; external?: boolean }) {
  return <section className="rounded-xl bg-white p-5 ring-1 ring-ink/10"><div className="flex items-center gap-3 border-b border-ink/10 pb-4 text-[#006b6b]">{icon}<h2 className="text-base font-semibold text-ink">{title}</h2></div><p className="mt-4 text-sm leading-relaxed text-ink/62">{description}</p>{href && <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border border-[#006b6b] px-4 text-sm font-medium text-[#006b6b] transition-colors hover:bg-[#e7f4f2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b] focus-visible:ring-offset-2">{action}</a>}</section>;
}
function DevelopmentPanel({ name, development }: { name: string; development?: { id: string; slug: string; brochureUrl?: string; priceListUrl?: string } }) {
  return <section className="rounded-xl bg-white p-5 ring-1 ring-ink/10"><div className="flex items-center gap-3 border-b border-ink/10 pb-4 text-[#006b6b]"><Building2 className="h-5 w-5" /><h2 className="text-base font-semibold text-ink">Desarrollo consultado</h2></div><p className="mt-4 text-sm font-semibold leading-relaxed text-ink">{name}</p>{development ? <div className="mt-4 grid gap-2">{development.brochureUrl && <a href={development.brochureUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center justify-between gap-2 rounded-lg border border-[#006b6b] px-4 text-sm font-medium text-[#006b6b] hover:bg-[#e7f4f2]"><span className="inline-flex items-center gap-2"><ExternalLink className="h-4 w-4" />Abrir brochure</span></a>}{development.priceListUrl && <a href={`/api/developments/${development.id}/price-list`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center justify-between gap-2 rounded-lg border border-[#006b6b] px-4 text-sm font-medium text-[#006b6b] hover:bg-[#e7f4f2]"><span className="inline-flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" />Lista de precios</span></a>}<Link href={`/desarrollos/${development.slug}`} target="_blank" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-ink/70 hover:bg-[#f3f4f4]"><Building2 className="h-4 w-4" />Ver ficha del desarrollo</Link>{!development.brochureUrl && !development.priceListUrl && <p className="rounded-lg bg-[#f3f4f4] px-3 py-3 text-xs leading-relaxed text-ink/60">Este desarrollo todavía no tiene brochure ni lista de precios cargados.</p>}</div> : <p className="mt-3 text-xs leading-relaxed text-ink/60">No encontramos un desarrollo vinculado para mostrar sus documentos.</p>}</section>;
}
function ActivityIcon({ type }: { type: string }) {
  if (type === "correo") return <Mail className="h-4 w-4" />;
  if (type === "whatsapp") return <MessageCircle className="h-4 w-4" />;
  if (type === "llamada") return <Phone className="h-4 w-4" />;
  if (type === "reunion") return <CalendarDays className="h-4 w-4" />;
  return <NotebookPen className="h-4 w-4" />;
}
function ActivityCard({ activity }: { activity: CrmActivity }) {
  return <article className="rounded-xl bg-white p-4 ring-1 ring-ink/10"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-sm font-semibold text-ink">{activity.title}</p><p className="mt-1 text-xs text-ink/50">{ACTIVITY_LABELS[activity.type] || activity.type}{activity.createdByName ? ` · ${activity.createdByName}` : ""}</p></div><span className="inline-flex items-center gap-1 text-xs text-ink/45"><Clock3 className="h-3.5 w-3.5" />{formatDate(activity.createdAt)}</span></div>{activity.scheduledAt && <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#006b6b]"><CalendarDays className="h-3.5 w-3.5" />Programado: {formatDate(activity.scheduledAt)}</p>}{activity.body && <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-ink/68">{activity.body}</p>}</article>;
}
function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-ink/8 pb-3"><dt className="text-xs font-medium capitalize text-ink/48">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-ink [overflow-wrap:anywhere]">{value}</dd></div>;
}
