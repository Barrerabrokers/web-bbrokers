import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { MetaCampaignDashboard } from "@/components/admin/meta-campaign-dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCrmMarketingPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login?from=/admin/crm/marketing");
  }
  if (session.user.role !== "admin") redirect("/admin/crm");

  return (
    <main className="min-h-screen bg-cream-100 px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm font-semibold text-accent">CRM / Marketing</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-ink">Rendimiento de campañas</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-ink/62">Inversión de Meta, generación de leads y avance comercial del CRM. Disponible exclusivamente para administradores.</p></div>
        </header>
        <MetaCampaignDashboard />
      </div>
    </main>
  );
}
