import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageListings } from "@/lib/roles";
import { CrmSectionCard, CrmSectionShell } from "@/components/admin/crm-section-shell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCrmOperationsPage() {
  const session = await getServerSession(authOptions);

  if (!session || !canManageListings(session.user.role)) {
    redirect("/login?from=/admin/crm/operaciones");
  }

  return (
    <CrmSectionShell
      eyebrow="CRM / Operaciones"
      title="Operaciones"
      description="Configuración operativa del CRM para mantener limpios los datos, las variables de HubSpot y los criterios comerciales del equipo."
    >
      <CrmSectionCard
        href="/admin/crm/propiedades"
        title="Propiedades de datos"
        description="Administrar estados del lead y desarrollos para que los datos importados desde HubSpot coincidan correctamente."
      />
      <CrmSectionCard
        href="/admin/crm/correo"
        title="Configuración de correo"
        description="Revisar la cuenta de correo personal usada para enviar mails desde el CRM."
      />
    </CrmSectionShell>
  );
}
