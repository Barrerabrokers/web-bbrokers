import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllAgents, getCrmDataProperties, getCrmLeads } from "@/lib/db";
import { HUBSPOT_LEAD_STATUS_OPTIONS } from "@/lib/crm-statuses";
import { getDevelopments } from "@/lib/developments-db";
import { canManageListings, canViewAllCrmContacts } from "@/lib/roles";
import { CrmBoard } from "@/components/admin/crm-board";
import { CrmMobileAccess } from "@/components/admin/crm-mobile-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCrmPage() {
  const session = await getServerSession(authOptions);

  if (!session || !canManageListings(session.user.role)) {
    redirect("/login?from=/admin/crm");
  }

  const canAssignTeam = canViewAllCrmContacts(session.user.role);
  const [leads, developments, agents, customLeadStatuses, customDevelopments] = await Promise.all([
    getCrmLeads({
      agentId: session.user.id,
      includeAll: canAssignTeam,
    }),
    getDevelopments(),
    canAssignTeam ? getAllAgents() : Promise.resolve([]),
    getCrmDataProperties("lead_status"),
    getCrmDataProperties("development"),
  ]);

  const crmDevelopmentOptions = [
    ...developments.map((development) => ({
      id: development.id,
      name: development.name,
    })),
    ...customDevelopments
      .filter((property) => property.active)
      .map((property) => ({
        id: property.localDevelopmentId || `text:${property.label}`,
        name: property.localDevelopmentName || property.label,
      })),
  ];

  const safeAgents = canAssignTeam
    ? agents
        .filter((agent) => agent.active)
        .map((agent) => ({
          id: agent.id,
          name: agent.name,
          email: agent.email,
          role: agent.role,
          active: agent.active,
        }))
    : [
        {
          id: session.user.id,
          name: session.user.name || "Mi usuario",
          email: session.user.email || "",
          role: session.user.role,
          active: true,
        },
      ];

  return (
    <>
      <CrmMobileAccess />
      <CrmBoard
        initialLeads={leads}
        initialActivities={[]}
        agents={safeAgents}
        developments={crmDevelopmentOptions}
        leadStatusOptions={[
          ...HUBSPOT_LEAD_STATUS_OPTIONS,
          ...customLeadStatuses
            .filter((property) => property.active)
            .map((property) => ({
              value: property.hubspotValue || property.value,
              label: property.label,
            })),
        ]}
        currentUserId={session.user.id}
        canAssignTeam={canAssignTeam}
      />
    </>
  );
}
