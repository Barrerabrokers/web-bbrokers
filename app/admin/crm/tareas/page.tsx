import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft, CalendarCheck2, Clock3, UserRound } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { ARGENTINA_TIME_ZONE, argentinaDateKey } from "@/lib/argentina-time";
import { getCrmActivities, getCrmLeads } from "@/lib/db";
import { canManageListings, canViewAllCrmContacts } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ARGENTINA_TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function CrmTasksPage() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) redirect("/login?from=/admin/crm/tareas");

  const includeAll = canViewAllCrmContacts(session.user.role);
  const leads = await getCrmLeads({ agentId: session.user.id, includeAll });
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const activities = await getCrmActivities(leads.map((lead) => lead.id), { calendarOnly: true });
  const tasks = activities
    .filter((activity) => activity.type === "tarea" && activity.scheduledAt)
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
  const today = argentinaDateKey(new Date());
  const overdue = tasks.filter((task) => argentinaDateKey(task.scheduledAt!) < today);
  const upcoming = tasks.filter((task) => argentinaDateKey(task.scheduledAt!) >= today);

  const TaskList = ({ items, overdue: isOverdue = false }: { items: typeof tasks; overdue?: boolean }) => items.length ? <ul className="divide-y divide-ink/10 rounded-xl border border-ink/15 bg-white">
    {items.map((task) => {
      const lead = leadById.get(task.leadId);
      const contact = lead ? `${lead.firstName} ${lead.lastName}`.trim() || "Contacto" : "Contacto no disponible";
      return <li key={task.id} className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0"><p className="text-base font-semibold text-ink">{task.title}</p>
            {task.body && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink/70">{task.body}</p>}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-ink/65">
              <span className={`inline-flex items-center gap-1.5 ${isOverdue ? "text-red-700" : "text-[#006b6b]"}`}><Clock3 className="h-3.5 w-3.5" />{isOverdue ? "Vencida · " : ""}{formatDate(task.scheduledAt!)}</span>
              {lead && <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />{contact}{includeAll && lead.assignedAgentName ? ` · ${lead.assignedAgentName}` : ""}</span>}
            </div>
          </div>
          {lead && <Link href={`/admin/crm/${lead.id}?activity=tarea`} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-[#006b6b] px-3 text-sm font-semibold text-[#006b6b] hover:bg-[#e7f4f2]">Ver contacto</Link>}
        </div>
      </li>;
    })}
  </ul> : <div className="rounded-xl border border-dashed border-ink/20 bg-white px-5 py-10 text-center"><CalendarCheck2 className="mx-auto h-8 w-8 text-[#006b6b]" /><p className="mt-3 text-sm font-semibold text-ink">No hay tareas {isOverdue ? "vencidas" : "pendientes"}.</p><p className="mt-1 text-sm text-ink/65">Las tareas creadas desde un contacto asignado aparecen acá automáticamente.</p></div>;

  return <main className="mx-auto max-w-5xl space-y-7 pb-28 lg:pb-12">
    <header className="border-b border-ink/10 pb-6"><Link href="/admin/crm" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-[#006b6b] hover:bg-[#e7f4f2]"><ArrowLeft className="h-4 w-4" />Volver a Contactos</Link><p className="mt-4 text-sm font-medium text-[#006b6b]">Organización personal</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.025em] text-ink">{includeAll ? "Tareas del equipo" : "Mis tareas"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-ink/65">Las tareas se asignan al agente responsable del contacto y se ordenan por su fecha programada.</p></header>
    <section aria-labelledby="upcoming-tasks"><div className="mb-3 flex items-baseline justify-between gap-3"><h2 id="upcoming-tasks" className="text-lg font-semibold text-ink">Pendientes</h2><span className="text-sm text-ink/60">{upcoming.length}</span></div><TaskList items={upcoming} /></section>
    {overdue.length > 0 && <section aria-labelledby="overdue-tasks"><div className="mb-3 flex items-baseline justify-between gap-3"><h2 id="overdue-tasks" className="text-lg font-semibold text-red-800">Vencidas</h2><span className="text-sm text-red-700">{overdue.length}</span></div><TaskList items={overdue} overdue /></section>}
  </main>;
}
