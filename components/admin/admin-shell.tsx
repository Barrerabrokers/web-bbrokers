"use client";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export function AdminShell({ children, session }: { children: React.ReactNode; session: Session }) {
  const pathname = usePathname();
  const router = useRouter();
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  const [isStandaloneCrm, setIsStandaloneCrm] = useState(false);
  const [editorMode, setEditorMode] = useState(false);
  const isContactDetail = /^\/admin\/crm\/[0-9a-f-]{36}$/i.test(pathname);
  useEffect(() => {
    if (isContactDetail) setNavigationCollapsed(true);
  }, [isContactDetail]);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandaloneCrm(standalone);
  }, [pathname]);
  useEffect(() => {
    if (!isStandaloneCrm) return;

    const isContactRoute = pathname === "/admin/crm" || /^\/admin\/crm\/[0-9a-f-]{36}$/i.test(pathname);
    if (!isContactRoute) router.replace("/admin/crm");
  }, [isStandaloneCrm, pathname, router]);
  useEffect(() => {
    const handleEditorMode = (event: Event) => {
      const active = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active);
      setEditorMode(active);
      if (active) setNavigationCollapsed(true);
    };
    window.addEventListener("admin-editor-mode", handleEditorMode);
    return () => window.removeEventListener("admin-editor-mode", handleEditorMode);
  }, []);
  return <SessionProvider session={session} refetchInterval={0} refetchOnWindowFocus={false}>
    <div className="admin-area min-h-screen bg-cream-200 text-ink"><AdminHeader crmOnly={isStandaloneCrm}/><div className="flex">
      {!isStandaloneCrm && <AdminSidebar collapsed={navigationCollapsed} onToggle={() => setNavigationCollapsed(value => !value)}/>} 
      <main className={`min-w-0 flex-1 ${isContactDetail || editorMode ? "p-0" : isStandaloneCrm ? "p-3 sm:p-4" : "p-6 md:p-10"}`}>{children}</main>
    </div></div>
  </SessionProvider>;
}
