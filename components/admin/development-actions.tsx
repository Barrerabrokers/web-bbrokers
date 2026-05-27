"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";

interface Props {
  developmentId: string;
  developmentName: string;
}

export function DevelopmentActions({ developmentId, developmentName }: Props) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setIsDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/developments/${developmentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
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

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          setShowConfirm(true);
        }}
        title="Eliminar desarrollo"
        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-red-500 hover:bg-red-500/10 transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-cream-200/85 backdrop-blur-sm p-4"
          onClick={(e) => {
            stop(e);
            if (!isDeleting) setShowConfirm(false);
          }}
        >
          <div
            className="card max-w-md w-full p-6 bg-cream-100/95"
            onClick={stop}
          >
            <div className="flex items-start gap-4 mb-5">
              <div className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-500/10 border border-red-500/30 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold tracking-tight text-ink mb-1">
                  Eliminar desarrollo?
                </h3>
                <p className="text-sm text-ink/60">
                  Estas seguro de eliminar &quot;{developmentName}&quot;? Esto
                  borrara todas sus unidades e imagenes. No se puede deshacer.
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  setShowConfirm(false);
                }}
                disabled={isDeleting}
                className="btn-outline text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  handleDelete();
                }}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {isDeleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
