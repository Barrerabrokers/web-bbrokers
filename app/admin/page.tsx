import { Building2, TrendingUp, Users, Eye } from "lucide-react";
import { getProperties } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboard() {
  const properties = await getProperties();
  const disponibles = properties.filter(p => p.status === "disponible").length;
  const vendidas = properties.filter(p => p.status === "vendida").length;
  const reservadas = properties.filter(p => p.status === "reservada").length;

  const stats = [
    {
      label: "Total Propiedades",
      value: properties.length,
      icon: Building2,
      color: "blue",
    },
    {
      label: "Disponibles",
      value: disponibles,
      icon: Eye,
      color: "green",
    },
    {
      label: "Reservadas",
      value: reservadas,
      icon: TrendingUp,
      color: "orange",
    },
    {
      label: "Vendidas",
      value: vendidas,
      icon: Users,
      color: "purple",
    },
  ];

  const colorClasses = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    orange: "bg-orange-100 text-orange-600",
    purple: "bg-purple-100 text-purple-600",
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Bienvenido al panel de administración</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`${colorClasses[stat.color as keyof typeof colorClasses]} p-3 rounded-lg`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {stat.value}
            </div>
            <div className="text-sm text-gray-600">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Properties */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            Propiedades Recientes
          </h2>
          <Link
            href="/admin/propiedades"
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            Ver todas →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  Título
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  Categoría
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  Precio
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  Estado
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody>
              {properties.slice(0, 5).map((property) => (
                <tr key={property.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <Link
                      href={`/admin/propiedades/${property.id}`}
                      className="text-gray-900 hover:text-primary-600 font-medium"
                    >
                      {property.title}
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700 capitalize">
                      {property.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-900 font-medium">
                    ${property.price.toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                        property.status === "disponible"
                          ? "bg-green-100 text-green-700"
                          : property.status === "reservada"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {property.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {new Date(property.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <Link
          href="/admin/propiedades/nueva"
          className="bg-primary-600 text-white p-6 rounded-xl hover:bg-primary-700 transition-colors"
        >
          <Building2 className="h-8 w-8 mb-3" />
          <h3 className="text-xl font-bold mb-2">Agregar Propiedad</h3>
          <p className="text-primary-100">
            Publica una nueva propiedad al catálogo
          </p>
        </Link>

        <Link
          href="/admin/contactos"
          className="bg-gray-900 text-white p-6 rounded-xl hover:bg-gray-800 transition-colors"
        >
          <Users className="h-8 w-8 mb-3" />
          <h3 className="text-xl font-bold mb-2">Ver Contactos</h3>
          <p className="text-gray-300">
            Revisa los mensajes de clientes potenciales
          </p>
        </Link>
      </div>
    </div>
  );
}
