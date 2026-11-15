import { AllPriceLists } from "@/components/admin/all-price-lists";
import { getAllPriceListsUrl, getSharedPriceLists } from "@/lib/all-price-lists";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageSiteSettings } from "@/lib/roles";
import { DevelopmentDocumentsManager } from "@/components/admin/development-documents-manager";
import { getDevelopments } from "@/lib/developments-db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDevelopmentDocumentsPage() {
  const [developments,url,entries,session] = await Promise.all([getDevelopments(),getAllPriceListsUrl(),getSharedPriceLists(),getServerSession(authOptions)]);

  return <DevelopmentDocumentsManager developments={developments} allPriceLists={<AllPriceLists initialUrl={url} initialEntries={entries} canEdit={canManageSiteSettings(session?.user.role)}/>} />;
}
