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
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/propiedades",
    label: "Propiedades",
    icon: Building2,
  },
  {
    href: "/admin/propiedades/nueva",
    label: "Nueva Propiedad",
    icon: Plus,
  },
  {
    href: "/admin/contactos",
    label: "Contactos",
    icon: FileText,
  },
];

const adminMenuItems = [
  {
    href: "/admin/agentes",
    label: "Agentes",
    icon: Users,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const menuItems = session?.user?.role === "admin"
    ? [...baseMenuItems, ...adminMenuItems]
    : baseMenuItems;

  return (
    <aside className="w-64 bg-white border-r border-charcoal-100 min-h-[calc(100vh-73px)]">
      <nav className="p-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center space-x-3 px-4 py-3 transition-colors",
                isActive
                  ? "bg-gold-50 text-gold-700 border-l-2 border-gold-500"
                  : "text-charcoal-700 hover:bg-charcoal-50"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="label-tracking text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
