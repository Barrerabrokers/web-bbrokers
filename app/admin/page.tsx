import {
  Building2,
  TrendingUp,
  Users,
  Eye,
  ArrowRight,
  Plus,
  Layers,
  Hammer,
  Home as HomeIcon,
} from "lucide-react";
import { getProperties } from "@/lib/db";
import { getDevelopments } from "@/lib/developments-db";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboard() {
  const [properties, developments] = await Promise.all([
    getProperties(),
    getDevelopments(),
  ]);

  // Property stats
  const disponibles = properties.filter((p) => p.status === "disponible").length;
  const vendidas = properties.filter((p) => p.status === "vendida").length;
  const reservadas = properties.filter((p) => p.status === "reservada").length;

  // Development stats
  const totalDevelopments = developments.length;
  const inConstruction = developments.filter(
    (d) => d.status === "en_construccion"
  ).length;
  const preSale = developments.filter((d) => d.status === "pre_venta").length;
  const totalUnits = developments.reduce(
    (sum, d) => sum + (d.unitsCount || 0),
    0
  );
  const availableUnits = developments.reduce(
    (sum, d) => sum + (d.availableUnits || 0),
    0
  );

  const developmentStats = [
    {
      label: "Desarrollos publicados",
      value: totalDevelopments,
      icon: Layers,
      sublabel: `${preSale} pre-venta · ${inConstruction} en construcción`,
      href: "/admin/desarrollos",
    },
    {
      label: "Unidades totales",
      value: totalUnits,
      icon: Building2,
      sublabel: `${availableUnits} disponibles`,
      href: "/admin/desarrollos",
    },
    {
      label: "En construcción",
      value: inConstruction,
      icon: Hammer,
      sublabel: "Proyectos activos",
      href: "/admin/desarrollos",
    },
    {
      label: "Pre-venta",
      value: preSale,
      icon: TrendingUp,
      sublabel: "Etapa inicial",
      href: "/admin/desarrollos",
    },
  ];

  const propertyStats = [
    { label: "Total propiedades", value: properties.length, icon: HomeIcon },
    { label: "Disponibles", value: disponibles, icon: Eye },
    { label: "Reservadas", value: reservadas, icon: TrendingUp },
    { label: "Vendidas", value: vendidas, icon: Users },
  ];

  const statusStyles: Record<string, string> = {
    disponible: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700",
    reservada: "bg-amber-500/10 border-amber-500/30 text-amber-700",
    vendida: "bg-gray-500/10 border-ink/25 text-ink/60",
  };

  const devStatusStyles: Record<string, string> = {
    pre_venta: "bg-blue-500/10 border-blue-500/30 text-blue-700",
    en_construccion: "bg-amber-500/10 border-amber-500/30 text-amber-700",
    finalizado: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700",
    entregado: "bg-gray-500/10 border-ink/25 text-ink/60",
  };

  const devStatusLabels: Record<string, string> = {
    pre_venta: "Pre-venta",
    en_construccion: "En construcción",
    finalizado: "Finalizado",
    entregado: "Entregado",
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink mb-1">
          Dashboard
        </h1>
        <p className="text-sm text-ink/60">
          Bienvenido al panel de administración
        </p>
      </div>

      {/* Developments Stats - hero del dashboard */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-ink tracking-tight">
            Desarrollos
          </h2>
          <Link
            href="/admin/desarrollos/nuevo"
            className="inline-flex items-center gap-1.5 text-xs text-accent-700 hover:text-ink transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo desarrollo
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {developmentStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Link
                key={index}
                href={stat.href}
                className="card p-5 hover:border-accent/40 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-accent/30 bg-accent/10 text-accent-700">
                    <Icon className="h-4 w-4" />
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-ink/30 group-hover:text-accent-700 group-hover:translate-x-1 transition-all" />
                </div>
                <div className="text-3xl font-semibold tracking-tightest text-ink mb-0.5">
                  {stat.value}
                </div>
                <div className="text-xs text-ink/60 tracking-tight mb-1">
                  {stat.label}
                </div>
                <div className="text-[10px] text-ink/40 uppercase tracking-widest">
                  {stat.sublabel}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Property Stats */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-ink tracking-tight mb-4">
          Propiedades
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {propertyStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="card p-5 hover:border-ink/25 transition-colors"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-ink/15 bg-cream-100 text-ink/70">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-3xl font-semibold tracking-tightest text-ink mb-0.5">
                  {stat.value}
                </div>
                <div className="text-xs text-ink/60 tracking-tight">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Developments */}
      {developments.length > 0 && (
        <div className="card overflow-hidden mb-6">
          <div className="flex items-center justify-between p-5 border-b border-ink/15">
            <h2 className="text-base font-semibold tracking-tight text-ink">
              Desarrollos recientes
            </h2>
            <Link
              href="/admin/desarrollos"
              className="inline-flex items-center gap-1 text-xs text-accent-700 hover:text-ink tracking-tight"
            >
              Ver todos
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/15 text-xs uppercase text-ink/60 tracking-widest bg-cream-100">
                  <th className="text-left py-3 px-5 font-medium">Nombre</th>
                  <th className="text-left py-3 px-5 font-medium">Ubicación</th>
                  <th className="text-left py-3 px-5 font-medium">Estado</th>
                  <th className="text-left py-3 px-5 font-medium">Avance</th>
                  <th className="text-left py-3 px-5 font-medium">Unidades</th>
                </tr>
              </thead>
              <tbody>
                {developments.slice(0, 5).map((dev) => (
                  <tr
                    key={dev.id}
                    className="border-b border-ink/15 hover:bg-cream-100/50 transition-colors"
                  >
                    <td className="py-3 px-5">
                      <Link
                        href={`/admin/desarrollos/${dev.id}/editar`}
                        className="text-ink hover:text-accent-700 font-medium"
                      >
                        {dev.name}
                      </Link>
                    </td>
                    <td className="py-3 px-5 text-ink/75">{dev.location}</td>
                    <td className="py-3 px-5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-medium border ${
                          devStatusStyles[dev.status] ?? devStatusStyles.entregado
                        }`}
                      >
                        {devStatusLabels[dev.status]}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-20 bg-ink/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent-700 rounded-full"
                            style={{ width: `${dev.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-ink/60">
                          {dev.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-ink/75">
                      {dev.availableUnits || 0}/{dev.unitsCount || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Properties */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-ink/15">
          <h2 className="text-base font-semibold tracking-tight text-ink">
            Propiedades recientes
          </h2>
          <Link
            href="/admin/propiedades"
            className="inline-flex items-center gap-1 text-xs text-accent-700 hover:text-ink tracking-tight"
          >
            Ver todas
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ink/15 text-xs uppercase text-ink/60 tracking-widest">
                <th className="text-left py-3 px-5 font-medium">Titulo</th>
                <th className="text-left py-3 px-5 font-medium">Categoria</th>
                <th className="text-left py-3 px-5 font-medium">Precio</th>
                <th className="text-left py-3 px-5 font-medium">Estado</th>
                <th className="text-left py-3 px-5 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {properties.slice(0, 5).map((property) => (
                <tr
                  key={property.id}
                  className="border-b border-ink/15 hover:bg-cream-200/60 transition-colors"
                >
                  <td className="py-3 px-5">
                    <Link
                      href={`/admin/propiedades/${property.id}/editar`}
                      className="text-sm text-ink hover:text-accent-700 font-medium"
                    >
                      {property.title}
                    </Link>
                  </td>
                  <td className="py-3 px-5">
                    <span className="pill capitalize">{property.category}</span>
                  </td>
                  <td className="py-3 px-5 text-sm text-ink/75 font-medium">
                    {formatPrice(property.price)}
                  </td>
                  <td className="py-3 px-5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${
                        statusStyles[property.status] ?? statusStyles.vendida
                      }`}
                    >
                      {property.status}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-xs text-ink/60">
                    {new Date(property.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {properties.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 px-5 text-center text-sm text-ink/60"
                  >
                    Aun no hay propiedades cargadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Link
          href="/admin/desarrollos/nuevo"
          className="group card p-6 hover:border-accent/40 hover:shadow-sm transition-all"
        >
          <div className="inline-flex items-center justify-center h-9 w-9 rounded-md bg-accent/10 border border-accent/40 text-accent-700 mb-4">
            <Layers className="h-4 w-4" />
          </div>
          <h3 className="text-base font-semibold tracking-tight text-ink mb-1">
            Nuevo desarrollo
          </h3>
          <p className="text-sm text-ink/60">
            Publicá un nuevo proyecto inmobiliario.
          </p>
        </Link>

        <Link
          href="/admin/propiedades/nueva"
          className="group card p-6 hover:border-accent/40 hover:shadow-sm transition-all"
        >
          <div className="inline-flex items-center justify-center h-9 w-9 rounded-md bg-accent/10 border border-accent/40 text-accent-700 mb-4">
            <Plus className="h-4 w-4" />
          </div>
          <h3 className="text-base font-semibold tracking-tight text-ink mb-1">
            Agregar propiedad
          </h3>
          <p className="text-sm text-ink/60">
            Publicá una nueva propiedad al catálogo.
          </p>
        </Link>

        <Link
          href="/admin/contactos"
          className="group card p-6 hover:border-ink/25 transition-all"
        >
          <div className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-ink/15 bg-cream-100 text-ink/75 mb-4">
            <Users className="h-4 w-4" />
          </div>
          <h3 className="text-base font-semibold tracking-tight text-ink mb-1">
            Ver contactos
          </h3>
          <p className="text-sm text-ink/60">
            Revisá los mensajes de clientes potenciales.
          </p>
        </Link>
      </div>
    </div>
  );
}
