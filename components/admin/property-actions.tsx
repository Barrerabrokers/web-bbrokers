"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Edit, Trash2, Eye, AlertTriangle } from "lucide-react";

interface Props {
  propertyId: string;
  propertyTitle: string;
}

export function PropertyActions({ propertyId, propertyTitle }: Props) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch(`/api/properties/${propertyId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Error al eliminar");
        setIsDeleting(false);
        return;
      }

      setShowConfirm(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Error al eliminar");
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex space-x-2">
        <Link
          href={`/propiedades/${propertyId}`}
          target="_blank"
          className="p-2 text-charcoal-600 hover:bg-charcoal-100 rounded-lg transition-colors"
          title="Ver en el sitio"
        >
          <Eye className="h-5 w-5" />
        </Link>
        <Link
          href={`/admin/propiedades/${propertyId}/editar`}
          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="Editar"
        >
          <Edit className="h-5 w-5" />
        </Link>
        <button
          onClick={() => setShowConfirm(true)}
          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Eliminar"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      {/* Modal de confirmación */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white max-w-md w-full p-6 shadow-xl">
            <div className="flex items-start space-x-4 mb-6">
              <div className="bg-red-100 p-3 rounded-full flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="heading-serif text-xl text-charcoal-900 mb-2">
                  Eliminar propiedad?
                </h3>
                <p className="text-charcoal-600">
                  Estas seguro que queres eliminar &quot;{propertyTitle}&quot;? Esta
                  accion no se puede deshacer.
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-2 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 border border-charcoal-300 text-charcoal-700 hover:bg-charcoal-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Eliminando..." : "Si, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
