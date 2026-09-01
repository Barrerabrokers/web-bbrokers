import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageListings } from "@/lib/roles";
import { CrmSectionCard, CrmSectionShell } from "@/components/admin/crm-section-shell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCrmMarketingPage() {
  const session = await getServerSession(authOptions);

  if (!session || !canManageListings(session.user.role)) {
    redirect("/login?from=/admin/crm/marketing");
  }

  return (
    <CrmSectionShell
      eyebrow="CRM / Marketing"
      title="Marketing"
      description="Área preparada para ordenar campañas, audiencias, mensajes y activos comerciales vinculados a los contactos del CRM."
    >
      <CrmSectionCard
        href="/admin/crm/plantillas"
        title="Plantillas de correo"
        description="Crear y editar correos comerciales reutilizables con variables del cliente, desarrollo y propietario."
      />
      <CrmSectionCard
        href="/admin/crm/marketing/whatsapp"
        title="Bandeja de WhatsApp"
        description="Atender conversaciones, asignar responsables y administrar el agente de IA conectado a la API oficial."
      />
      <CrmSectionCard
        href="/admin/crm/plantillas"
        title="Campañas y plantillas"
        description="Preparar mensajes reutilizables, variables personalizadas y contenido para campañas de WhatsApp y correo."
      />
      <CrmSectionCard
        href="/admin/crm/workflows"
        title="Automatizaciones"
        description="Crear seguimientos inmediatos, programados y repetibles según el estado del contacto."
      />
      <CrmSectionCard
        href="/admin/crm"
        title="Segmentos de contactos"
        description="Volver a contactos para filtrar por propietario, desarrollo, estado del lead y origen."
      />
    </CrmSectionShell>
  );
}
