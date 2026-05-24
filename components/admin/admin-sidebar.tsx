"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Building2,
  Plus,
  FileText,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const baseMenuItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/propiedades", label: "Propiedades", icon: Building2 },
  { href: "/admin/propiedades/nueva", label: "Nueva propiedad", icon: Plus },
  { href: "/admin/contactos", label: "Contactos", icon: FileText },
];

const adminMenuItems = [{ href: "/admin/agentes", label: "Agentes", icon: Users }];

export function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const menuItems =
    session?.user?.role === "admin"
      ? [...baseMenuItems, ...adminMenuItems]
      : baseMenuItems;

  return (
    <aside className="w-60 bg-cream-200 border-r border-ink/15 min-h-[calc(100vh-56px)] sticky top-14 hidden md:block">
      <nav className="p-3 space-y-0.5">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm",
                isActive
                  ? "bg-cream-100 text-ink border border-ink/15"
                  : "text-ink/60 hover:text-ink hover:bg-cream-200 border border-transparent"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 flex-shrink-0",
                  isActive ? "text-accent" : ""
                )}
              />
              <span className="tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
