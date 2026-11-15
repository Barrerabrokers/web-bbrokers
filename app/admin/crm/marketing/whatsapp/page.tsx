import { inspectMetaSocialConnection } from "@/lib/meta-social";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessMarketing, canViewAllCrmContacts } from "@/lib/roles";
import { getAllAgents } from "@/lib/db";
import { listWhatsAppConversations } from "@/lib/whatsapp-inbox";
import { WhatsAppInbox } from "@/components/admin/whatsapp-inbox";
import { WhatsAppEmbeddedSignup } from "@/components/admin/whatsapp-embedded-signup";
import { getWhatsAppChannelCredentials } from "@/lib/whatsapp-credentials";

export const dynamic = "force-dynamic";

export default async function WhatsAppInboxPage({ searchParams: pendingsearchParams }: { searchParams?: Promise<{ channel?: string; lead?: string; embedded?: string }> }) {
  const searchParams = (await pendingsearchParams) || {};
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?from=/admin/crm/marketing/whatsapp");
  if (!canAccessMarketing(session.user.role)) redirect("/admin/crm");
  const isAdmin = canViewAllCrmContacts(session.user.role);
  const [conversations, allAgents, savedWhatsApp] = await Promise.all([
    listWhatsAppConversations({ agentId: session.user.id, includeAll: isAdmin }),
    isAdmin ? getAllAgents() : Promise.resolve([]),
    getWhatsAppChannelCredentials(),
  ]);
  const social = await inspectMetaSocialConnection();
  return <>{isAdmin && <WhatsAppEmbeddedSignup initialConnection={savedWhatsApp ? { displayPhoneNumber: savedWhatsApp.displayPhoneNumber } : undefined} />}<WhatsAppInbox initialChannel={searchParams.channel === "instagram" ? "instagram" : searchParams.channel === "whatsapp" ? "whatsapp" : "all"} initialSelectedId={conversations.find(c => c.leadId === searchParams.lead)?.id} initialConversations={conversations} agents={allAgents.filter((agent) => agent.active).map((agent) => ({ id: agent.id, name: agent.name }))} isAdmin={isAdmin} configured={{
    whatsapp: Boolean((process.env.WHATSAPP_ACCESS_TOKEN || savedWhatsApp?.accessToken || process.env.META_ACCESS_TOKEN) && (process.env.WHATSAPP_PHONE_NUMBER_ID || savedWhatsApp?.phoneNumberId)),
    instagram: social.connected && social.canReadInstagram,
    facebook: social.connected,
    ai: true,
  }} /></>;
}
