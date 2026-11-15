import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { HUBSPOT_LEAD_STATUS_OPTIONS } from "@/lib/crm-statuses";
import { getCrmEmailTemplates, getCrmWorkflows } from "@/lib/db";
import { canManageAdminPanel } from "@/lib/roles";
import { CrmWorkflowManager } from "@/components/admin/crm-workflow-manager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCrmWorkflowsPage() {
  const session = await getServerSession(authOptions);

  if (!session || !canManageAdminPanel(session.user.role)) {
    redirect("/login?from=/admin/crm/workflows");
  }

  const [workflows, templates] = await Promise.all([
    getCrmWorkflows(),
    getCrmEmailTemplates(),
  ]);

  return (
    <CrmWorkflowManager
      initialWorkflows={workflows}
      leadStatusOptions={[...HUBSPOT_LEAD_STATUS_OPTIONS]}
      emailTemplates={templates}
    />
  );
}
