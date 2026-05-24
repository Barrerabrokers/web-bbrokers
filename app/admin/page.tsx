import { Building2, TrendingUp, Users, Eye, ArrowRight, Plus } from "lucide-react";
import { getProperties } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboard() {
  const properties = await getProperties();
  const disponibles = properties.filter((p) => p.status === "disponible").length;
  const vendidas = properties.filter((p) => p.status === "vendida").length;
  const reservadas = properties.filter((p) => p.status === "reservada").length;

  const stats = [
    { label: "Total propiedades", value: properties.length, icon: Building2 },
    { label: "Disponibles", value: disponibles, icon: Eye },
    { label: "Reservadas", value: reservadas, icon: TrendingUp },
    { label: "Vendidas", value: vendidas, icon: Users },
  ];

  const statusStyles: Record<string, string> = {
    disponible: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    reservada: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    vendida: "bg-gray-500/10 border-gray-700 text-gray-400",
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-50 mb-1">
          Dashboard
        </h1>
        <p className="text-sm text-gray-400">
          Bienvenido al panel de administracion
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="card p-5 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-gray-800 bg-gray-900 text-accent-300">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="text-3xl font-semibold tracking-tightest text-gray-50 mb-0.5">
                {stat.value}
              </div>
              <div className="text-xs text-gray-500 tracking-tight">
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Properties */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-base font-semibold tracking-tight text-gray-50">
            Propiedades recientes
          </h2>
          <Link
            href="/admin/propiedades"
            className="inline-flex items-center gap-1 text-xs text-accent-300 hover:text-accent-400 tracking-tight"
          >
            Ver todas
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-xs uppercase text-gray-500 tracking-widest">
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
                  className="border-b border-gray-800 hover:bg-gray-900/60 transition-colors"
                >
                  <td className="py-3 px-5">
                    <Link
                      href={`/admin/propiedades/${property.id}/editar`}
                      className="text-sm text-gray-100 hover:text-accent-300 font-medium"
                    >
                      {property.title}
                    </Link>
                  </td>
                  <td className="py-3 px-5">
                    <span className="pill capitalize">{property.category}</span>
                  </td>
                  <td className="py-3 px-5 text-sm text-gray-300 font-medium">
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
                  <td className="py-3 px-5 text-xs text-gray-500">
                    {new Date(property.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {properties.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 px-5 text-center text-sm text-gray-500"
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Link
          href="/admin/propiedades/nueva"
          className="group card p-6 hover:border-accent/40 hover:shadow-glow transition-all relative overflow-hidden"
        >
          <div className="absolute inset-0 -z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-glow-accent" />
          <div className="inline-flex items-center justify-center h-9 w-9 rounded-md bg-accent/10 border border-accent/30 text-accent-300 mb-4">
            <Plus className="h-4 w-4" />
          </div>
          <h3 className="text-base font-semibold tracking-tight text-gray-50 mb-1">
            Agregar propiedad
          </h3>
          <p className="text-sm text-gray-400">
            Publica una nueva propiedad al catalogo.
          </p>
        </Link>

        <Link
          href="/admin/contactos"
          className="group card p-6 hover:border-gray-700 transition-all"
        >
          <div className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-gray-800 bg-gray-900 text-gray-300 mb-4">
            <Users className="h-4 w-4" />
          </div>
          <h3 className="text-base font-semibold tracking-tight text-gray-50 mb-1">
            Ver contactos
          </h3>
          <p className="text-sm text-gray-400">
            Revisa los mensajes de clientes potenciales.
          </p>
        </Link>
      </div>
    </div>
  );
}
