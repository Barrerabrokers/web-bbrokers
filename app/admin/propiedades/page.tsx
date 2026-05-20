import Link from "next/link";
import { Plus, Edit, Trash2, Eye } from "lucide-react";
import { getProperties } from "@/lib/db";
import { formatPrice } from "@/lib/utils";

export default async function PropertiesAdminPage() {
  const properties = await getProperties();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Propiedades</h1>
          <p className="text-gray-600">Gestiona todas las propiedades del catálogo</p>
        </div>
        <Link
          href="/admin/propiedades/nueva"
          className="flex items-center space-x-2 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Nueva Propiedad</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
            <option value="">Todas las categorías</option>
            <option value="desarrollo">En Desarrollo</option>
            <option value="pozo">En Pozo</option>
            <option value="usados">Usados</option>
            <option value="rentals">Alquileres</option>
            <option value="inversiones">Inversiones</option>
            <option value="oportunidades">Oportunidades</option>
          </select>

          <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
            <option value="">Todos los estados</option>
            <option value="disponible">Disponible</option>
            <option value="reservada">Reservada</option>
            <option value="vendida">Vendida</option>
          </select>

          <input
            type="text"
            placeholder="Buscar por título..."
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />

          <button className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800">
            Buscar
          </button>
        </div>
      </div>

      {/* Properties Grid */}
      <div className="grid grid-cols-1 gap-6">
        {properties.map((property) => (
          <div
            key={property.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="md:flex">
              <div className="md:w-64 h-48 md:h-auto">
                <img
                  src={property.images[0]}
                  alt={property.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700 capitalize">
                        {property.category}
                      </span>
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
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {property.title}
                    </h3>
                    <p className="text-gray-600 mb-2">{property.location}</p>
                    <p className="text-2xl font-bold text-primary-600">
                      {formatPrice(property.price)}
                    </p>
                  </div>

                  <div className="flex space-x-2">
                    <Link
                      href={`/propiedades/${property.id}`}
                      target="_blank"
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Ver en el sitio"
                    >
                      <Eye className="h-5 w-5" />
                    </Link>
                    <Link
                      href={`/admin/propiedades/${property.id}/editar`}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit className="h-5 w-5" />
                    </Link>
                    <button
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {property.bedrooms && (
                    <div>
                      <span className="text-gray-600">Dormitorios:</span>
                      <span className="ml-1 font-semibold">{property.bedrooms}</span>
                    </div>
                  )}
                  {property.bathrooms && (
                    <div>
                      <span className="text-gray-600">Baños:</span>
                      <span className="ml-1 font-semibold">{property.bathrooms}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-600">Área:</span>
                    <span className="ml-1 font-semibold">{property.area}m²</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Fecha:</span>
                    <span className="ml-1 font-semibold">
                      {new Date(property.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {properties.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No hay propiedades
          </h3>
          <p className="text-gray-600 mb-4">
            Comienza agregando tu primera propiedad al catálogo
          </p>
          <Link
            href="/admin/propiedades/nueva"
            className="inline-flex items-center space-x-2 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700"
          >
            <Plus className="h-5 w-5" />
            <span>Nueva Propiedad</span>
          </Link>
        </div>
      )}
    </div>
  );
}
