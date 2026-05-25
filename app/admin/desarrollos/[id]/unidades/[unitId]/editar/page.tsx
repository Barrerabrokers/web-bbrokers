import { notFound } from "next/navigation";
import { getDevelopmentById, getUnitById } from "@/lib/developments-db";
import { UnitForm } from "@/components/admin/unit-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditUnitPage({
  params,
}: {
  params: { id: string; unitId: string };
}) {
  const [development, unit] = await Promise.all([
    getDevelopmentById(params.id),
    getUnitById(params.unitId),
  ]);

  if (!development || !unit) notFound();

  return (
    <UnitForm
      developmentId={development.id}
      developmentName={development.name}
      unit={unit}
    />
  );
}
