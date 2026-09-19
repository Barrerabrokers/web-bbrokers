import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CrmCalendarView } from "@/components/admin/crm-calendar-view";
import { authOptions } from "@/lib/auth";
import { getCrmEmailAccount } from "@/lib/db";
import { canManageListings } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCrmCalendarPage() {
  const session = await getServerSession(authOptions);

  if (!session || !canManageListings(session.user.role)) {
    redirect("/login?from=/admin/crm/calendario");
  }

  const emailAccount = await getCrmEmailAccount(session.user.id);

  return (
    <CrmCalendarView
      email={emailAccount?.email || null}
      isGoogleConnected={emailAccount?.provider === "google-oauth"}
    />
  );
}
