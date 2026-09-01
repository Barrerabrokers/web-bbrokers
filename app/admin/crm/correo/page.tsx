import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCrmEmailAccount } from "@/lib/db";
import { canManageListings } from "@/lib/roles";
import { CrmEmailSettings } from "@/components/admin/crm-email-settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCrmEmailPage() {
  const session = await getServerSession(authOptions);

  if (!session || !canManageListings(session.user.role)) {
    redirect("/login?from=/admin/crm/correo");
  }

  const account = await getCrmEmailAccount(session.user.id);
  return <CrmEmailSettings account={account} />;
}
