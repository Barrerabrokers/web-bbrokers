import { DevelopmentDocumentsManager } from "@/components/admin/development-documents-manager";
import { getDevelopments } from "@/lib/developments-db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDevelopmentDocumentsPage() {
  const developments = await getDevelopments();

  return <DevelopmentDocumentsManager developments={developments} />;
}
