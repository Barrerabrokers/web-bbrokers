import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPropertyById } from "@/lib/db";
import { canManageListings } from "@/lib/roles";
import { absoluteUrl } from "@/lib/seo";
import { createShareToken, withShareParam, withListingPreviewParam } from "@/lib/share-token";
import { ListingMailRecipient } from "@/components/admin/listing-mail-recipient";
import type { ListingMailDraft } from "@/components/admin/crm-email-composer";

export const dynamic = "force-dynamic";

export default async function ListingMailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) {
    redirect(`/login?from=${encodeURIComponent(`/admin/crm/correo/propiedad/${id}`)}`);
  }
  const property = await getPropertyById(id);
  if (!property) notFound();
  const token = property.visibility === "agents" ? createShareToken("property", id) : undefined;
  const pageUrl = absoluteUrl(withListingPreviewParam(withShareParam(`/propiedades/${id}`, token), property.images[0]));
  const coverUrl = absoluteUrl(withListingPreviewParam(withShareParam(`/api/properties/${id}/portada`, token), property.images[0]));
  const pdfUrl = absoluteUrl(withShareParam(`/api/properties/${id}/ficha`, token));
  const body = `Hola,\n\nTe comparto esta propiedad: ${property.title}\n\nVer propiedad: ${pageUrl}\n\nVer ficha PDF: ${pdfUrl}`;
  const draft: ListingMailDraft = { subject: `Ficha de propiedad - ${property.title}`, body, imageUrls: [coverUrl], contentBlocks: [
    { id: "listing-intro", type: "text", text: `Hola,\n\nTe comparto esta propiedad: ${property.title}` },
    { id: "listing-cover", type: "image", url: coverUrl, alt: property.title, width: 100, linkUrl: pageUrl },
    { id: "listing-link", type: "button", label: "Ver propiedad", url: pageUrl },
    { id: "listing-pdf", type: "button", label: "Ver ficha PDF", url: pdfUrl },
  ] };
  return <ListingMailRecipient title={property.title} coverUrl={coverUrl} draft={draft} currentAgentId={session.user.id} />;
}
