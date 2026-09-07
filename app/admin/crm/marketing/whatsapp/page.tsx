import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageListings, canViewAllCrmContacts } from "@/lib/roles";
import { getAllAgents } from "@/lib/db";
import { listWhatsAppConversations } from "@/lib/whatsapp-inbox";
import { WhatsAppInbox } from "@/components/admin/whatsapp-inbox";
import { WhatsAppEmbeddedSignup } from "@/components/admin/whatsapp-embedded-signup";
import { getWhatsAppChannelCredentials } from "@/lib/whatsapp-credentials";

export const dynamic = "force-dynamic";

export default async function WhatsAppInboxPage() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) redirect("/login?from=/admin/crm/marketing/whatsapp");
  const isAdmin = canViewAllCrmContacts(session.user.role);
  const [conversations, allAgents, savedWhatsApp] = await Promise.all([
    listWhatsAppConversations({ agentId: session.user.id, includeAll: isAdmin }),
    isAdmin ? getAllAgents() : Promise.resolve([]),
    isAdmin ? getWhatsAppChannelCredentials() : Promise.resolve(null),
  ]);
  return <>{isAdmin && <WhatsAppEmbeddedSignup initialConnection={savedWhatsApp ? { displayPhoneNumber: savedWhatsApp.displayPhoneNumber } : undefined} />}<WhatsAppInbox initialConversations={conversations} agents={allAgents.filter((agent) => agent.active).map((agent) => ({ id: agent.id, name: agent.name }))} isAdmin={isAdmin} configured={{
    whatsapp: Boolean((process.env.WHATSAPP_ACCESS_TOKEN || savedWhatsApp?.accessToken || process.env.META_ACCESS_TOKEN) && (process.env.WHATSAPP_PHONE_NUMBER_ID || savedWhatsApp?.phoneNumberId)),
    instagram: Boolean((process.env.META_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN) && process.env.META_PAGE_ID),
    facebook: Boolean((process.env.META_PAGE_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN) && process.env.META_PAGE_ID),
    ai: Boolean(process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY),
  }} /></>;
}
