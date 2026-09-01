import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCrmDataProperties } from "@/lib/db";
import { HUBSPOT_LEAD_STATUS_OPTIONS } from "@/lib/crm-statuses";
import { getDevelopments } from "@/lib/developments-db";
import { canManageAdminPanel, canManageListings } from "@/lib/roles";
import { CrmDataPropertiesManager } from "@/components/admin/crm-data-properties-manager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCrmPropertiesPage() {
  const session = await getServerSession(authOptions);

  if (!session || !canManageListings(session.user.role)) {
    redirect("/login?from=/admin/crm/propiedades");
  }

  const [properties, developments] = await Promise.all([
    getCrmDataProperties(),
    getDevelopments(),
  ]);
  const customStatusValues = new Set(
    properties
      .filter((property) => property.type === "lead_status")
      .map((property) => property.hubspotValue || property.value)
  );
  const hubSpotBaseStatuses = HUBSPOT_LEAD_STATUS_OPTIONS
    .filter((status) => !customStatusValues.has(status.value))
    .map((status) => ({
      id: `hubspot:${status.value}`,
      type: "lead_status" as const,
      value: status.value,
      label: status.label,
      hubspotValue: status.value,
      active: true,
      sortOrder: 0,
      createdAt: "",
      updatedAt: "",
    }));

  return (
    <CrmDataPropertiesManager
      initialProperties={[...hubSpotBaseStatuses, ...properties]}
      developments={developments.map((development) => ({
        id: development.id,
        name: development.name,
      }))}
      canEdit={canManageAdminPanel(session.user.role)}
    />
  );
}
