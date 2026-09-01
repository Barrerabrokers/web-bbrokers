"use client";

import { FormEvent, useMemo, useState } from "react";
import { Database, Loader2, Plus, Trash2 } from "lucide-react";
import type { CrmDataProperty, CrmDataPropertyType } from "@/lib/db";

type DevelopmentOption = {
  id: string;
  name: string;
};

type CrmDataPropertiesManagerProps = {
  initialProperties: CrmDataProperty[];
  developments: DevelopmentOption[];
  canEdit: boolean;
};

type PropertyFormState = {
  type: CrmDataPropertyType;
  label: string;
  value: string;
  hubspotValue: string;
  localDevelopmentId: string;
};

const EMPTY_FORM: PropertyFormState = {
  type: "lead_status",
  label: "",
  value: "",
  hubspotValue: "",
  localDevelopmentId: "",
};

const typeLabels: Record<CrmDataPropertyType, string> = {
  lead_status: "Estado del lead",
  development: "Desarrollo",
};

export function CrmDataPropertiesManager({
  initialProperties,
  developments,
  canEdit,
}: CrmDataPropertiesManagerProps) {
  const [properties, setProperties] = useState(initialProperties);
  const [form, setForm] = useState<PropertyFormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const grouped = useMemo(
    () => ({
      lead_status: properties.filter((property) => property.type === "lead_status"),
      development: properties.filter((property) => property.type === "development"),
    }),
    [properties]
  );

  const updateForm = (patch: Partial<PropertyFormState>) => {
    setForm((current) => {
      const next = { ...current, ...patch };
      if (patch.label !== undefined && !current.value.trim()) {
        next.value = patch.label;
      }
      return next;
    });
  };

  const saveProperty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit || isSaving) return;
    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/crm/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          localDevelopmentId: form.type === "development" ? form.localDevelopmentId : "",
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { property?: CrmDataProperty; error?: string }
        | null;

      if (!response.ok || !data?.property) {
        throw new Error(data?.error || "No se pudo guardar la propiedad");
      }

      setProperties((current) => [
        data.property!,
        ...current.filter((property) => property.id !== data.property!.id),
      ]);
      setForm((current) => ({ ...EMPTY_FORM, type: current.type }));
      setNotice("Propiedad guardada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la propiedad");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteProperty = async (property: CrmDataProperty) => {
    if (!canEdit || deletingId) return;
    const confirmed = window.confirm(`¿Eliminar "${property.label}" de Propiedades de datos?`);
    if (!confirmed) return;

    setDeletingId(property.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/crm/properties?id=${encodeURIComponent(property.id)}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "No se pudo eliminar la propiedad");
      setProperties((current) => current.filter((item) => item.id !== property.id));
      setNotice("Propiedad eliminada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la propiedad");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <main className="bg-cream-100 px-4 py-6 sm:px-6">
      <div className="mx-auto grid max-w-[1600px] gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-md border border-ink/12 bg-white p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white">
              <Database className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">
                Propiedades CRM
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                Variables para importar mejor
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink/62">
                Agregá los valores que existen en HubSpot para que el CRM pueda reconocer estados
                y desarrollos aunque todavía no estén creados en Barrera Brokers.
              </p>
            </div>
          </div>

          <form onSubmit={saveProperty} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/52">
                Tipo
              </span>
              <select
                value={form.type}
                onChange={(event) =>
                  updateForm({ type: event.target.value as CrmDataPropertyType, localDevelopmentId: "" })
                }
                disabled={!canEdit}
                className="mt-2 h-11 w-full rounded-md border border-ink/16 bg-white px-3 text-sm text-ink outline-none focus:border-accent"
              >
                <option value="lead_status">Estado del lead</option>
                <option value="development">Desarrollo</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/52">
                Nombre visible
              </span>
              <input
                value={form.label}
                onChange={(event) => updateForm({ label: event.target.value })}
                disabled={!canEdit}
                placeholder={form.type === "lead_status" ? "Ej. Interesado" : "Ej. Alpha Libertador"}
                className="mt-2 h-11 w-full rounded-md border border-ink/16 bg-white px-3 text-sm text-ink outline-none placeholder:text-ink/45 focus:border-accent"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/52">
                Valor interno
              </span>
              <input
                value={form.value}
                onChange={(event) => updateForm({ value: event.target.value })}
                disabled={!canEdit}
                placeholder="Como llega desde HubSpot o como querés guardarlo"
                className="mt-2 h-11 w-full rounded-md border border-ink/16 bg-white px-3 text-sm text-ink outline-none placeholder:text-ink/45 focus:border-accent"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/52">
                Valor exacto HubSpot
              </span>
              <input
                value={form.hubspotValue}
                onChange={(event) => updateForm({ hubspotValue: event.target.value })}
                disabled={!canEdit}
                placeholder="Opcional. Ej. Facebook Lead Ads: formulario libertador"
                className="mt-2 h-11 w-full rounded-md border border-ink/16 bg-white px-3 text-sm text-ink outline-none placeholder:text-ink/45 focus:border-accent"
              />
            </label>

            {form.type === "development" && (
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/52">
                  Vincular con desarrollo local
                </span>
                <select
                  value={form.localDevelopmentId}
                  onChange={(event) => updateForm({ localDevelopmentId: event.target.value })}
                  disabled={!canEdit}
                  className="mt-2 h-11 w-full rounded-md border border-ink/16 bg-white px-3 text-sm text-ink outline-none focus:border-accent"
                >
                  <option value="">Solo guardar el nombre importado</option>
                  {developments.map((development) => (
                    <option key={development.id} value={development.id}>
                      {development.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {error && <p className="text-sm font-medium text-red-700">{error}</p>}
            {notice && <p className="text-sm font-medium text-emerald-700">{notice}</p>}

            <button
              type="submit"
              disabled={!canEdit || isSaving}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Guardar propiedad
            </button>
          </form>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {(["lead_status", "development"] as const).map((type) => (
            <div key={type} className="rounded-md border border-ink/12 bg-white">
              <div className="border-b border-ink/10 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">
                  {typeLabels[type]}
                </p>
                <h3 className="mt-1 text-xl font-semibold text-ink">
                  {grouped[type].length} valor{grouped[type].length !== 1 ? "es" : ""}
                </h3>
              </div>
              <div className="divide-y divide-ink/8">
                {grouped[type].length === 0 ? (
                  <p className="p-5 text-sm text-ink/56">
                    Todavía no hay variables cargadas para este grupo.
                  </p>
                ) : (
                  grouped[type].map((property) => (
                    <div key={property.id} className="flex items-start justify-between gap-4 p-5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-ink">{property.label}</p>
                          {property.id.startsWith("hubspot:") && (
                            <span className="rounded-full border border-ink/12 bg-cream-100 px-2 py-0.5 text-[11px] font-medium text-ink/56">
                              Base HubSpot
                            </span>
                          )}
                        </div>
                        <p className="mt-1 break-words text-sm text-ink/58">
                          Valor: <span className="font-medium text-ink/75">{property.value}</span>
                        </p>
                        {property.hubspotValue && (
                          <p className="mt-1 break-words text-sm text-ink/58">
                            HubSpot: <span className="font-medium text-ink/75">{property.hubspotValue}</span>
                          </p>
                        )}
                        {property.localDevelopmentName && (
                          <p className="mt-1 text-sm text-ink/58">
                            Vinculado a:{" "}
                            <span className="font-medium text-ink/75">
                              {property.localDevelopmentName}
                            </span>
                          </p>
                        )}
                      </div>
                      {canEdit && !property.id.startsWith("hubspot:") && (
                        <button
                          type="button"
                          onClick={() => deleteProperty(property)}
                          disabled={deletingId === property.id}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-200 text-red-700 transition-colors hover:bg-red-50 disabled:opacity-55"
                          aria-label={`Eliminar ${property.label}`}
                        >
                          {deletingId === property.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
