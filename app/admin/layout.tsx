"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { useEffect } from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-200">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-ink/15 border-t-accent" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="admin-area min-h-screen bg-cream-200 text-ink">
      <AdminHeader />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6 md:p-10 max-w-[1600px]">{children}</main>
      </div>
    </div>
  );
}
