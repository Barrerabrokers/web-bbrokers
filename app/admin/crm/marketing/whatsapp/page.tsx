import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageListings, canViewAllCrmContacts } from "@/lib/roles";
import { getAllAgents } from "@/lib/db";
import { listWhatsAppConversations } from "@/lib/whatsapp-inbox";
import { WhatsAppInbox } from "@/components/admin/whatsapp-inbox";

export const dynamic = "force-dynamic";

export default async function WhatsAppInboxPage() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) redirect("/login?from=/admin/crm/marketing/whatsapp");
  const isAdmin = canViewAllCrmContacts(session.user.role);
  const [conversations, allAgents] = await Promise.all([
    listWhatsAppConversations({ agentId: session.user.id, includeAll: isAdmin }),
    isAdmin ? getAllAgents() : Promise.resolve([]),
  ]);
  return <WhatsAppInbox initialConversations={conversations} agents={allAgents.filter((agent) => agent.active).map((agent) => ({ id: agent.id, name: agent.name }))} isAdmin={isAdmin} configured={Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.OPENAI_API_KEY)} />;
}
