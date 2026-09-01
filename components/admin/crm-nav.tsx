"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { CalendarDays, CalendarPlus, Mail, Megaphone, PanelsTopLeft, Settings2, UserCog, UsersRound, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { canManageAdminPanel } from "@/lib/roles";

const crmNavItems = [
  {
    href: "/admin/crm",
    label: "Contactos",
    description: "Leads y actividad comercial",
    icon: UsersRound,
  },
  {
    href: "/admin/crm/correo",
    label: "Correo de CRM",
    description: "Cuenta personal y envío",
    icon: Mail,
  },
  {
    href: "/admin/crm/calendario",
    label: "Calendario",
    description: "Reuniones y recordatorios",
    icon: CalendarDays,
  },
  {
    href: "/admin/crm/reuniones",
    label: "Link de reuniones",
    description: "Agenda online para clientes",
    icon: CalendarPlus,
  },
  {
    href: "/admin/crm/plantillas",
    label: "Plantillas",
    description: "Mails guardados",
    icon: PanelsTopLeft,
  },
  {
    href: "/admin/crm/marketing",
    label: "Marketing",
    description: "Campañas y audiencias",
    icon: Megaphone,
  },
  {
    href: "/admin/crm/workflows",
    label: "Workflows",
    description: "Automatizaciones",
    icon: Workflow,
  },
  {
    href: "/admin/crm/operaciones",
    label: "Operaciones",
    description: "Datos y configuración",
    icon: Settings2,
  },
  {
    href: "/admin/agentes",
    label: "Agentes",
    description: "Equipo y accesos",
    icon: UserCog,
    adminOnly: true,
  },
];

export function CrmNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const visibleCrmNavItems = crmNavItems.filter(
    (item) => !item.adminOnly || canManageAdminPanel(session?.user?.role)
  );

  return (
    <section className="border-b border-ink/10 bg-cream-50 px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">
            CRM
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            Centro comercial
          </h1>
        </div>
        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Navegación interna de CRM">
          {visibleCrmNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin/crm" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-[190px] items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35",
                  isActive
                    ? "border-ink bg-ink text-white"
                    : "border-ink/12 bg-white text-ink hover:border-ink/28 hover:bg-cream-100"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive ? "text-white" : "text-accent")} />
                <span>
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className={cn("block text-xs", isActive ? "text-white/65" : "text-ink/52")}>
                    {item.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </section>
  );
}
