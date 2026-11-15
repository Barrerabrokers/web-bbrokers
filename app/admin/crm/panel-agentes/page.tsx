import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canManageListings } from "@/lib/roles";
import { CrmAgentDashboard } from "@/components/admin/crm-agent-dashboard";
export const dynamic = "force-dynamic";
export default async function AgentPanelPage() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) redirect("/login?from=/admin/crm/panel-agentes");
  return <CrmAgentDashboard admin={session.user.role === "admin"} currentUserId={session.user.id} currentUserName={session.user.name || "Mi actividad"} />;
}
