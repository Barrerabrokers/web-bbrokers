import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFullSiteSettings } from "@/lib/db";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user?.role !== "admin") {
    redirect("/admin");
  }

  const settings = await getFullSiteSettings();

  return (
    <div className="max-w-3xl">
      <header className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink/50 mb-2">
          Administración
        </p>
        <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight mb-2">
          Configuración del sitio
        </h1>
        <p className="text-sm text-ink/60 max-w-xl">
          Estos datos se reflejan automáticamente en el header, footer, sección
          de contacto, botón de WhatsApp y la sección &ldquo;Nosotros&rdquo; del sitio público.
        </p>
      </header>

      <SettingsForm initial={settings} />
    </div>
  );
}
