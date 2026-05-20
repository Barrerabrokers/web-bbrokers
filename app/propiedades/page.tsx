import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getProperties } from "@/lib/db";
import { PropertyCard } from "@/components/property-card";
import { Filter } from "lucide-react";
import { PROPERTY_CATEGORIES } from "@/types";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: { categoria?: string };
}) {
  const category = searchParams.categoria;
  const properties = await getProperties(category ? { category } : {});

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {category
                ? PROPERTY_CATEGORIES.find((c) => c.value === category)?.label
                : "Todas las Propiedades"}
            </h1>
            <p className="text-lg text-gray-600">
              {category
                ? PROPERTY_CATEGORIES.find((c) => c.value === category)?.description
                : "Explora nuestro catálogo completo de propiedades disponibles"}
            </p>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex items-center space-x-2 mb-4">
              <Filter className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Filtrar por Categoría</h3>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <a
                href="/propiedades"
                className={`px-4 py-2 rounded-lg transition-colors ${
                  !category
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Todas
              </a>
              {PROPERTY_CATEGORIES.map((cat) => (
                <a
                  key={cat.value}
                  href={`/propiedades?categoria=${cat.value}`}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    category === cat.value
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {cat.label}
                </a>
              ))}
            </div>
          </div>

          {/* Properties Grid */}
          {properties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {properties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-gray-50 rounded-xl">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No hay propiedades disponibles
              </h3>
              <p className="text-gray-600">
                Vuelve pronto para ver nuevas propiedades en esta categoría
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
