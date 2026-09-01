"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Building2,
  Users,
  Layers,
  UserCog,
  Settings,
  ContactRound,
  CalendarDays,
  CalendarPlus,
  Mail,
  Megaphone,
  PanelsTopLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Workflow,
  Files,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canManageAdminPanel } from "@/lib/roles";

const baseMenuItems = [
  { href: "/admin/crm", label: "CRM", icon: ContactRound },
  { href: "/admin/desarrollos/listas", label: "Precios y Brochures", icon: Files },
  { href: "/admin/desarrollos", label: "Desarrollos", icon: Layers },
  { href: "/admin/propiedades", label: "Propiedades", icon: Building2 },
];

const crmSubmenuItems = [
  { href: "/admin/crm", label: "Contactos", icon: Users },
  { href: "/admin/crm/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/admin/crm/reuniones", label: "Link de reuniones", icon: CalendarPlus },
  { href: "/admin/crm/correo", label: "Correo de CRM", icon: Mail },
  { href: "/admin/crm/plantillas", label: "Plantillas", icon: PanelsTopLeft },
  { href: "/admin/crm/marketing", label: "Marketing", icon: Megaphone },
  { href: "/admin/crm/workflows", label: "Workflows", icon: Workflow },
  { href: "/admin/crm/operaciones", label: "Operaciones", icon: Settings2 },
  { href: "/admin/agentes", label: "Agentes", icon: UserCog, adminOnly: true },
];

const adminMenuItems = [
  { href: "/admin/settings", label: "Configuración", icon: Settings },
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
];

export function AdminSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  const menuItems = canManageAdminPanel(role)
    ? [...baseMenuItems, ...adminMenuItems]
    : baseMenuItems;

  return (
    <aside
      className={cn(
        "sticky top-14 hidden min-h-[calc(100vh-56px)] border-r border-ink/15 bg-cream-200 transition-[width] duration-200 md:block",
        collapsed ? "w-[76px]" : "w-60"
      )}
    >
      <nav className="p-3 space-y-0.5">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "mb-3 flex min-h-10 w-full items-center gap-3 rounded-md border border-ink/12 bg-cream-50 px-3 text-sm font-medium text-ink transition-colors hover:bg-cream-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35",
            collapsed && "justify-center px-0"
          )}
          aria-label={collapsed ? "Ampliar navegación" : "Contraer navegación"}
          title={collapsed ? "Ampliar navegación" : "Contraer navegación"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 text-accent" />
          ) : (
            <PanelLeftClose className="h-4 w-4 text-accent" />
          )}
          {!collapsed && <span>Contraer navegación</span>}
        </button>
        {menuItems.map((item) => {
          const isCrmItem = item.href === "/admin/crm";
          const isActive = isCrmItem
            ? pathname.startsWith("/admin/crm") || pathname === "/admin/agentes"
            : pathname === item.href;
          const Icon = item.icon;
          const visibleCrmSubmenuItems = crmSubmenuItems.filter(
            (subItem) => !subItem.adminOnly || canManageAdminPanel(role)
          );

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm",
                  collapsed && "justify-center px-0",
                  isActive
                    ? "bg-cream-100 text-ink border border-ink/15"
                    : "text-ink/60 hover:text-ink hover:bg-cream-200 border border-transparent"
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 flex-shrink-0",
                    isActive ? "text-accent" : ""
                  )}
                />
                {!collapsed && <span className="tracking-tight">{item.label}</span>}
              </Link>
              {isCrmItem && isActive && !collapsed && (
                <div className="my-1 ml-5 space-y-0.5 border-l border-ink/12 pl-3">
                  {visibleCrmSubmenuItems.map((subItem) => {
                    const SubIcon = subItem.icon;
                    const isSubActive = pathname === subItem.href;

                    return (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        className={cn(
                          "flex items-center gap-2 rounded-md border px-3 py-1.5 text-[13px] transition-colors",
                          isSubActive
                            ? "border-ink/15 bg-cream-50 text-ink"
                            : "border-transparent text-ink/58 hover:bg-cream-100 hover:text-ink"
                        )}
                      >
                        <SubIcon
                          className={cn(
                            "h-3.5 w-3.5 flex-shrink-0",
                            isSubActive ? "text-accent" : "text-ink/42"
                          )}
                        />
                        <span>{subItem.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
