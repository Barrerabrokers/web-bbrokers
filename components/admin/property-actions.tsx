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
      <div className="flex items-center gap-1">
        <Link
          href={`/propiedades/${propertyId}`}
          target="_blank"
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-ink/60 hover:text-ink hover:bg-cream-300 transition-colors"
          title="Ver en el sitio"
        >
          <Eye className="h-4 w-4" />
        </Link>
        <Link
          href={`/admin/propiedades/${propertyId}/editar`}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-accent hover:bg-accent/10 transition-colors"
          title="Editar"
        >
          <Edit className="h-4 w-4" />
        </Link>
        <button
          onClick={() => setShowConfirm(true)}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-red-400 hover:bg-red-500/10 transition-colors"
          title="Eliminar"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-cream-200/85 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => !isDeleting && setShowConfirm(false)}
        >
          <div
            className="card max-w-md w-full p-6 backdrop-blur-md bg-cream-100/95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-5">
              <div className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-500/10 border border-red-500/30 text-red-300">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold tracking-tight text-ink mb-1">
                  Eliminar propiedad?
                </h3>
                <p className="text-sm text-ink/60">
                  Estas seguro de eliminar &quot;{propertyTitle}&quot;? Esta
                  accion no se puede deshacer.
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
                className="btn-outline text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium tracking-tight bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
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
