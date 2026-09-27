import { notFound } from "next/navigation";
import { getDevelopmentById } from "@/lib/developments-db";
import { UnitForm } from "@/components/admin/unit-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewUnitPage({
  params: pendingparams,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = await pendingparams;
  const development = await getDevelopmentById(params.id);
  if (!development) notFound();

  return (
    <UnitForm
      developmentId={development.id}
      developmentName={development.name}
    />
  );
}
