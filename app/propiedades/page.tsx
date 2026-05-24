import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getProperties } from "@/lib/db";
import { PropertyCard } from "@/components/property-card";
import { Filter } from "lucide-react";
import { PROPERTY_CATEGORIES } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: { categoria?: string };
}) {
  const category = searchParams.categoria;
  const properties = await getProperties(category ? { category } : {});

  const activeCategory = category
    ? PROPERTY_CATEGORIES.find((c) => c.value === category)
    : null;

  return (
    <div className="min-h-screen">
      <Header />

      <main className="pt-32 pb-24">
        <div className="container-custom">
          {/* Header */}
          <div className="mb-10 max-w-3xl">
            <span className="eyebrow mb-5">Catalogo</span>
            <h1 className="mt-5 text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tightest leading-[1.05] mb-5">
              <span className="text-gradient">
                {activeCategory ? activeCategory.label : "Todas las propiedades"}
              </span>
            </h1>
            <p className="text-lg text-gray-400 leading-relaxed tracking-tight">
              {activeCategory
                ? activeCategory.description
                : "Explora nuestro catalogo completo de propiedades disponibles."}
            </p>
          </div>

          {/* Filters */}
          <div className="card p-5 mb-8">
            <div className="flex items-center gap-2 mb-4 text-gray-400">
              <Filter className="h-4 w-4" />
              <span className="text-xs font-medium tracking-tight uppercase">
                Filtrar por categoria
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/propiedades"
                className={`px-3.5 py-1.5 text-sm rounded-md border transition-all ${
                  !category
                    ? "bg-accent border-accent text-white shadow-glow"
                    : "bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-850 hover:border-gray-700"
                }`}
              >
                Todas
              </a>
              {PROPERTY_CATEGORIES.map((cat) => (
                <a
                  key={cat.value}
                  href={`/propiedades?categoria=${cat.value}`}
                  className={`px-3.5 py-1.5 text-sm rounded-md border transition-all ${
                    category === cat.value
                      ? "bg-accent border-accent text-white shadow-glow"
                      : "bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-850 hover:border-gray-700"
                  }`}
                >
                  {cat.label}
                </a>
              ))}
            </div>
          </div>

          {/* Properties Grid */}
          {properties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {properties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          ) : (
            <div className="card p-16 text-center">
              <h3 className="text-lg font-semibold tracking-tight text-gray-50 mb-2">
                No hay propiedades disponibles
              </h3>
              <p className="text-gray-400 text-sm">
                Volve pronto para ver nuevas propiedades en esta categoria.
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
