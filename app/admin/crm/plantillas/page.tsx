import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCrmEmailTemplates } from "@/lib/db";
import { canManageListings } from "@/lib/roles";
import { CrmTemplateManager } from "@/components/admin/crm-template-manager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCrmTemplatesPage() {
  const session = await getServerSession(authOptions);

  if (!session || !canManageListings(session.user.role)) {
    redirect("/login?from=/admin/crm/plantillas");
  }

  const templates = await getCrmEmailTemplates();
  return <CrmTemplateManager initialTemplates={templates} />;
}
