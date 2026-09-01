"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, FileText, Link2, Loader2, Save, Upload } from "lucide-react";
import type { Development } from "@/types";
import { supabase } from "@/lib/supabase";

const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;

type DevelopmentDocumentRow = {
  id: string;
  name: string;
  slug: string;
  location: string;
  brochureUrl: string;
  priceListUrl: string;
};

type DevelopmentDocumentsManagerProps = {
  developments: Development[];
};

function toRow(development: Development): DevelopmentDocumentRow {
  return {
    id: development.id,
    name: development.name,
    slug: development.slug,
    location: development.location,
    brochureUrl: development.brochureUrl || "",
    priceListUrl: development.priceListUrl || "",
  };
}

function isValidOptionalUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function DevelopmentDocumentsManager({
  developments,
}: DevelopmentDocumentsManagerProps) {
  const [rows, setRows] = useState<DevelopmentDocumentRow[]>(
    developments.map(toRow)
  );
  const [savingId, setSavingId] = useState("");
  const [uploadingDocument, setUploadingDocument] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        row.location.toLowerCase().includes(term)
    );
  }, [query, rows]);

  const updateRow = (
    id: string,
    field: "brochureUrl" | "priceListUrl",
    value: string
  ) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
    setNotice("");
    setError("");
  };

  const saveRow = async (row: DevelopmentDocumentRow) => {
    if (!isValidOptionalUrl(row.priceListUrl)) {
      setError(`La lista de precios de ${row.name} no es un link válido.`);
      return;
    }
    if (!isValidOptionalUrl(row.brochureUrl)) {
      setError(`El brochure de ${row.name} no es un link válido.`);
      return;
    }

    setSavingId(row.id);
    setNotice("");
    setError("");

    try {
      const response = await fetch(`/api/developments/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceListUrl: row.priceListUrl.trim() || null,
          brochureUrl: row.brochureUrl.trim() || null,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || "No se pudieron guardar los documentos");
      }

      setNotice(`Documentos actualizados para ${row.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los documentos");
    } finally {
      setSavingId("");
    }
  };

  const uploadDocument = async (
    row: DevelopmentDocumentRow,
    field: "brochureUrl" | "priceListUrl",
    folder: "brochures" | "price-lists",
    file: File
  ) => {
    const documentLabel = field === "brochureUrl" ? "brochure" : "lista de precios";
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (file.type !== "application/pdf" && extension !== "pdf") {
      setError(`La ${documentLabel} debe ser un archivo PDF.`);
      return;
    }
    if (file.size > MAX_DOCUMENT_SIZE) {
      setError(`La ${documentLabel} no puede superar los 20 MB.`);
      return;
    }

    setUploadingDocument(`${row.id}:${field}`);
    setNotice("");
    setError("");

    try {
      const fileName = `${folder}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("properties")
        .upload(fileName, file, {
          cacheControl: "3600",
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) throw new Error(uploadError.message);

      const { data } = supabase.storage.from("properties").getPublicUrl(fileName);
      updateRow(row.id, field, data.publicUrl);
      setNotice(`${field === "brochureUrl" ? "Brochure" : "Lista de precios"} cargada para ${row.name}. Guardá los cambios para publicarla.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? `No se pudo subir la ${documentLabel}: ${err.message}`
          : `No se pudo subir la ${documentLabel}.`
      );
    } finally {
      setUploadingDocument("");
    }
  };

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent-700">
            Desarrollos
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink md:text-3xl">
            Listas de precio y brochures
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink/62">
            Pegá los links de Google Drive o documentos públicos de cada desarrollo.
            Las listas quedan visibles solo para usuarios logueados y los brochures se muestran en la ficha comercial.
          </p>
        </div>
        <Link
          href="/admin/desarrollos/nuevo"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-ink/16 px-4 text-sm font-medium text-ink transition-colors hover:bg-cream-100"
        >
          Nuevo desarrollo
        </Link>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <div className="mb-5 rounded-xl border border-ink/12 bg-white p-4">
        <label className="block">
          <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.16em] text-ink/50">
            Buscar desarrollo
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre o barrio"
            className="form-input"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-ink/12 bg-white">
        <div className="grid grid-cols-[1.1fr_1fr_1fr_150px] gap-4 border-b border-ink/10 bg-cream-100 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/48 max-xl:hidden">
          <span>Desarrollo</span>
          <span>Lista de precios</span>
          <span>Brochure</span>
          <span>Acciones</span>
        </div>

        {filteredRows.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="mx-auto h-10 w-10 text-ink/25" />
            <p className="mt-3 text-sm text-ink/55">
              No encontramos desarrollos con esa búsqueda.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-ink/10">
            {filteredRows.map((row) => {
              const isSaving = savingId === row.id;
              return (
                <div
                  key={row.id}
                  className="grid gap-4 px-5 py-5 xl:grid-cols-[1.1fr_1fr_1fr_150px] xl:items-center"
                >
                  <div>
                    <p className="font-medium text-ink">{row.name}</p>
                    <p className="mt-1 text-xs text-ink/50">{row.location}</p>
                    <Link
                      href={`/admin/desarrollos/${row.id}/editar`}
                      className="mt-2 inline-flex text-xs font-medium text-accent-700 hover:underline"
                    >
                      Editar ficha completa
                    </Link>
                  </div>

                  <DocumentField
                    label="Lista de precios"
                    value={row.priceListUrl}
                    placeholder="https://drive.google.com/..."
                    onChange={(value) => updateRow(row.id, "priceListUrl", value)}
                    openHref={
                      row.priceListUrl ? `/api/developments/${row.id}/price-list` : ""
                    }
                    accept="application/pdf,.pdf"
                    uploadLabel="Subir PDF (máx. 20 MB)"
                    isUploading={uploadingDocument === `${row.id}:priceListUrl`}
                    onUpload={(file) =>
                      uploadDocument(row, "priceListUrl", "price-lists", file)
                    }
                  />

                  <DocumentField
                    label="Brochure"
                    value={row.brochureUrl}
                    placeholder="https://drive.google.com/..."
                    onChange={(value) => updateRow(row.id, "brochureUrl", value)}
                    openHref={row.brochureUrl}
                    accept="application/pdf,.pdf"
                    uploadLabel="Subir PDF (máx. 20 MB)"
                    isUploading={uploadingDocument === `${row.id}:brochureUrl`}
                    onUpload={(file) =>
                      uploadDocument(row, "brochureUrl", "brochures", file)
                    }
                  />

                  <button
                    type="button"
                    onClick={() => saveRow(row)}
                    disabled={isSaving}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-bone transition-colors hover:bg-ink-600 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {isSaving ? "Guardando" : "Guardar"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentField({
  label,
  value,
  placeholder,
  openHref,
  onChange,
  accept,
  uploadLabel,
  isUploading = false,
  onUpload,
}: {
  label: string;
  value: string;
  placeholder: string;
  openHref: string;
  onChange: (value: string) => void;
  accept?: string;
  uploadLabel?: string;
  isUploading?: boolean;
  onUpload?: (file: File) => void;
}) {
  return (
    <div className="block">
      <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.16em] text-ink/50 xl:hidden">
        {label}
      </span>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="form-input pl-10"
            type="url"
          />
        </div>
        {openHref && (
          <a
            href={openHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-ink/14 text-ink transition-colors hover:bg-cream-100"
            title={`Abrir ${label}`}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
      {onUpload && (
        <label className="mt-2 inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-xs font-medium text-accent-700 transition-colors hover:bg-cream-100 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-700">
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {isUploading ? "Subiendo brochure…" : uploadLabel}
          <input
            type="file"
            accept={accept}
            disabled={isUploading}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}
