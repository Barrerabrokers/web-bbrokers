import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CrmCalendarView } from "@/components/admin/crm-calendar-view";
import { authOptions } from "@/lib/auth";
import { getCrmActivities, getCrmEmailAccount, getCrmLeads } from "@/lib/db";
import { canManageListings, canViewAllCrmContacts } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCrmCalendarPage() {
  const session = await getServerSession(authOptions);

  if (!session || !canManageListings(session.user.role)) {
    redirect("/login?from=/admin/crm/calendario");
  }

  const includeAll = canViewAllCrmContacts(session.user.role);
  const [leads, emailAccount] = await Promise.all([
    getCrmLeads({
      agentId: session.user.id,
      includeAll,
    }),
    getCrmEmailAccount(session.user.id),
  ]);
  const activities = await getCrmActivities(leads.map((lead) => lead.id));
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const calendarActivities = activities.map((activity) => ({
    ...activity,
    lead: leadById.get(activity.leadId),
  }));

  return (
    <CrmCalendarView
      activities={calendarActivities}
      leads={leads}
      email={emailAccount?.email || null}
      isGoogleConnected={emailAccount?.provider === "google-oauth"}
    />
  );
}
