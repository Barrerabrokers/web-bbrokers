import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageListings } from "@/lib/roles";
import { MeetingLinkManager } from "@/components/admin/meeting-link-manager";
import { getMeetingLinkByAgent } from "@/lib/meeting-scheduler";

export const dynamic = "force-dynamic";

export default async function MeetingLinksPage() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) redirect("/login?from=/admin/crm/reuniones");
  const link = await getMeetingLinkByAgent(session.user.id);
  return <MeetingLinkManager initial={link} agentName={session.user.name || "Asesor"} />;
}
