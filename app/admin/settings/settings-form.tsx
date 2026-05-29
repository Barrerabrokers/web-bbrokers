"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import type { FullSiteSettings } from "@/lib/db";
import { Building2, Mail, MapPin, Save, Info, Upload, X, Loader2 } from "lucide-react";

export function SettingsForm({ initial }: { initial: FullSiteSettings }) {
  const [data, setData]      = useState<FullSiteSettings>(initial);
  const [status, setStatus]  = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const update =
    (k: keyof FullSiteSettings) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setData((prev) => ({ ...prev, [k]: e.target.value }));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("files", file);
      formData.append("folder", "settings");

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }

      const j = await res.json();
      const url = j.urls?.[0];
      if (!url) throw new Error("No se recibió la URL");

      setData((prev) => ({ ...prev, aboutImage: url }));
    } catch (err: any) {
      setError(err?.message || "Error al subir imagen");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("saving");
    setError(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }

      const saved = await res.json();
      setData(saved);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err: any) {
      setStatus("error");
      setError(err?.message || "Error al guardar");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Empresa ── */}
      <fieldset className="bg-cream-100 border border-ink/10 rounded-xl p-5 md:p-6">
        <legend className="px-2 text-[10px] uppercase tracking-[0.2em] text-ink/50 flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5" />
          Empresa
        </legend>

        <div className="space-y-4 mt-2">
          <Field
            label="Nombre de la empresa"
            value={data.companyName}
            onChange={update("companyName")}
            placeholder="Barrera Brokers"
            required
          />
        </div>
      </fieldset>

      {/* ── Contacto ── */}
      <fieldset className="bg-cream-100 border border-ink/10 rounded-xl p-5 md:p-6">
        <legend className="px-2 text-[10px] uppercase tracking-[0.2em] text-ink/50 flex items-center gap-2">
          <Mail className="h-3.5 w-3.5" />
          Contacto
        </legend>

        <div className="space-y-4 mt-2">
          <Field label="Email de contacto" type="email" value={data.email} onChange={update("email")} placeholder="info@empresa.com" required />
          <Field label="Teléfono (formato visible)" value={data.phone} onChange={update("phone")} placeholder="+54 11 1234-5678" hint="Así se muestra al usuario." required />
          <Field label="WhatsApp (solo números, con código de país)" value={data.whatsapp} onChange={update("whatsapp")} placeholder="541112345678" hint="Sin '+', sin espacios, sin guiones." required />
          <TextareaField label="Mensaje predefinido de WhatsApp" value={data.whatsappMessage} onChange={update("whatsappMessage")} placeholder="Hola! Me interesa…" rows={3} hint="Se pre-completa cuando el cliente toca el botón flotante." />
        </div>
      </fieldset>

      {/* ── Dirección ── */}
      <fieldset className="bg-cream-100 border border-ink/10 rounded-xl p-5 md:p-6">
        <legend className="px-2 text-[10px] uppercase tracking-[0.2em] text-ink/50 flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5" />
          Dirección
        </legend>
        <div className="space-y-4 mt-2">
          <Field label="Calle y número" value={data.addressStreet} onChange={update("addressStreet")} placeholder="Av. Principal 123" />
          <Field label="Ciudad / País" value={data.addressCity} onChange={update("addressCity")} placeholder="Buenos Aires, Argentina" />
        </div>
      </fieldset>

      {/* ── Sección Nosotros ── */}
      <fieldset className="bg-cream-100 border border-ink/10 rounded-xl p-5 md:p-6">
        <legend className="px-2 text-[10px] uppercase tracking-[0.2em] text-ink/50 flex items-center gap-2">
          <Info className="h-3.5 w-3.5" />
          Sección &ldquo;Nosotros&rdquo;
        </legend>

        <div className="space-y-5 mt-2">
          {/* Imagen */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/55 mb-2">
              Imagen principal
            </label>

            <div className="flex flex-col sm:flex-row gap-4">
              {data.aboutImage && (
                <div className="relative w-full sm:w-48 aspect-[4/5] rounded-lg overflow-hidden border border-ink/10 bg-cream-200 flex-shrink-0">
                  <Image
                    src={data.aboutImage}
                    alt="Imagen Nosotros"
                    fill
                    className="object-cover"
                    sizes="200px"
                  />
                  <button
                    type="button"
                    onClick={() => setData((p) => ({ ...p, aboutImage: "" }))}
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/90 hover:bg-white text-ink flex items-center justify-center shadow-sm transition-all"
                    aria-label="Quitar imagen"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="flex-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-ink/20 text-sm text-ink hover:bg-cream-200 transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Subiendo…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      {data.aboutImage ? "Cambiar imagen" : "Subir imagen"}
                    </>
                  )}
                </button>
                <p className="text-[11px] text-ink/45 mt-2 leading-relaxed">
                  Formato recomendado: vertical (4:5).<br />
                  JPG o PNG. Máx 5 MB.
                </p>

                <div className="mt-4 pt-4 border-t border-ink/10">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/55 mb-2">
                    O pegá una URL externa
                  </label>
                  <input
                    type="url"
                    value={data.aboutImage}
                    onChange={update("aboutImage")}
                    placeholder="https://…"
                    className="form-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Textos */}
          <Field label="Eyebrow (etiqueta superior)" value={data.aboutEyebrow} onChange={update("aboutEyebrow")} placeholder="Nosotros" />
          <Field label="Título" value={data.aboutTitle} onChange={update("aboutTitle")} placeholder="Una inmobiliaria independiente" hint='Para resaltar una palabra en cursiva, escribila igual — la última palabra se muestra en italic.' />
          <TextareaField label="Descripción" value={data.aboutDescription} onChange={update("aboutDescription")} rows={4} placeholder="Nacimos en…" />

          {/* Stat */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Número (stat)" value={data.aboutStatNumber} onChange={update("aboutStatNumber")} placeholder="+500" />
            <div className="sm:col-span-2">
              <Field label="Etiqueta del stat" value={data.aboutStatLabel} onChange={update("aboutStatLabel")} placeholder="Operaciones realizadas" />
            </div>
          </div>

          {/* Valores 1, 2, 3 */}
          <div className="pt-4 mt-4 border-t border-ink/10 space-y-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/45">
              Tres pilares
            </p>

            {[1, 2, 3].map((n) => {
              const titleKey = `aboutValue${n}Title` as keyof FullSiteSettings;
              const descKey  = `aboutValue${n}Description` as keyof FullSiteSettings;
              return (
                <div key={n} className="bg-white/40 rounded-lg p-4 space-y-3 border border-ink/5">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
                    Pilar 0{n}
                  </div>
                  <Field
                    label="Título"
                    value={data[titleKey] as string}
                    onChange={update(titleKey)}
                  />
                  <TextareaField
                    label="Descripción"
                    value={data[descKey] as string}
                    onChange={update(descKey)}
                    rows={2}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </fieldset>

      {/* ── Acciones ── */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <div className="text-sm">
          {status === "saved"  && <span className="text-emerald-700">✓ Cambios guardados.</span>}
          {status === "error"  && <span className="text-red-700">{errorMsg}</span>}
          {status === "idle"   && !errorMsg && <span className="text-ink/40">Los cambios se reflejan al instante.</span>}
          {status === "idle"   && errorMsg && <span className="text-red-700">{errorMsg}</span>}
          {status === "saving" && <span className="text-ink/55">Guardando…</span>}
        </div>

        <button
          type="submit"
          disabled={status === "saving" || uploading}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-ink text-cream-100 text-[11px] uppercase tracking-[0.2em] font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02]"
        >
          <Save className="h-3.5 w-3.5" />
          {status === "saving" ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

/* ── Helpers ── */
function Field({
  label,
  hint,
  type = "text",
  ...rest
}: {
  label: string;
  hint?: string;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/55 mb-2">
        {label}
      </label>
      <input type={type} className="form-input" {...rest} />
      {hint && <p className="text-[11px] text-ink/45 mt-1.5">{hint}</p>}
    </div>
  );
}

function TextareaField({
  label,
  hint,
  rows = 3,
  ...rest
}: {
  label: string;
  hint?: string;
  rows?: number;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/55 mb-2">
        {label}
      </label>
      <textarea rows={rows} className="form-input resize-none" {...rest} />
      {hint && <p className="text-[11px] text-ink/45 mt-1.5">{hint}</p>}
    </div>
  );
}
