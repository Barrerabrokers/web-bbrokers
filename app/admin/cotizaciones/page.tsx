import { QuoteForm } from "@/components/admin/quote-form";
import { getDevelopments } from "@/lib/developments-db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminQuotesPage() {
  const developments = await getDevelopments();

  return (
    <QuoteForm
      developments={developments.map((development) => ({
        id: development.id,
        name: development.name,
        slug: development.slug,
        location: development.location,
        address: development.address,
        currency: development.currency || "USD",
      }))}
    />
  );
}
