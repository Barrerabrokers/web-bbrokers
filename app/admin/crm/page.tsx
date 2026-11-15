import { isCrmDevelopmentName } from "@/lib/crm-campaign";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllAgents, getCrmActivities, getCrmDataProperties, getCrmLeadsPage, getCrmOccupationOptions } from "@/lib/db";
import { HUBSPOT_LEAD_STATUS_OPTIONS } from "@/lib/crm-statuses";
import { getDevelopmentOptions } from "@/lib/developments-db";
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
  const [leadPage, developments, agents, customProperties, occupations] = await Promise.all([
    getCrmLeadsPage({
      agentId: session.user.id,
      includeAll: canAssignTeam,
      ownerId: session.user.id,
      page: 1,
      pageSize: 50,
      sortColumn: "createdAt",
      sortDirection: "desc",
    }),
    getDevelopmentOptions(),
    getAllAgents(),
    getCrmDataProperties(),
    getCrmOccupationOptions({ agentId: session.user.id, includeAll: canAssignTeam }),
  ]);

  const customDevelopments = customProperties.filter((property) => property.type === "development");
  const initialActivities = await getCrmActivities(leadPage.leads.map((lead) => lead.id));

  const crmDevelopmentOptions = [
    ...customDevelopments.filter(property => property.active && isCrmDevelopmentName(property.localDevelopmentName || property.label) && !developments.some(d => d.id === property.localDevelopmentId || d.name.trim().toLowerCase() === (property.localDevelopmentName || property.label).trim().toLowerCase())).map(property => ({ id: property.localDevelopmentId || `text:${property.label}`, name: property.localDevelopmentName || property.label })),
    ...developments.map((development) => ({
      id: development.id,
      name: development.name,
    })),

  ];

  const safeAgents = agents.filter(agent => agent.active && canManageListings(agent.role)).map(agent => ({
    id: agent.id, name: agent.name, email: agent.email, role: agent.role, active: agent.active,
  }));

  return (
    <>
      <CrmMobileAccess />
      <CrmBoard
        initialLeads={leadPage.leads}
        initialTotal={leadPage.total}
        initialActivities={initialActivities}
        agents={safeAgents}
        developments={crmDevelopmentOptions}
        occupations={occupations}
        leadStatusOptions={[...HUBSPOT_LEAD_STATUS_OPTIONS]}
        currentUserId={session.user.id}
        canAssignTeam={canAssignTeam}
      />
    </>
  );
}
