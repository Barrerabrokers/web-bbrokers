"use client";

import { useState } from "react";
import type { SiteSettings } from "@/lib/db";
import { Building2, Mail, Phone, MessageCircle, MapPin, Save } from "lucide-react";

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const [data, setData]       = useState<SiteSettings>(initial);
  const [status, setStatus]   = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setError]  = useState<string | null>(null);

  const update = (k: keyof SiteSettings) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setData((prev) => ({ ...prev, [k]: e.target.value }));

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
          <Field
            label="Email de contacto"
            type="email"
            value={data.email}
            onChange={update("email")}
            placeholder="info@empresa.com"
            required
          />

          <Field
            label="Teléfono (formato visible)"
            value={data.phone}
            onChange={update("phone")}
            placeholder="+54 11 1234-5678"
            hint="Ej: +54 11 1234-5678 — así se muestra al usuario."
            required
          />

          <Field
            label="WhatsApp (solo números, con código de país)"
            value={data.whatsapp}
            onChange={update("whatsapp")}
            placeholder="541112345678"
            hint="Sin '+', sin espacios, sin guiones. Ej: 541112345678"
            required
          />

          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/55 mb-2">
              Mensaje predefinido de WhatsApp
            </label>
            <textarea
              value={data.whatsappMessage}
              onChange={update("whatsappMessage")}
              rows={3}
              className="form-input resize-none"
              placeholder="Hola! Me interesa…"
            />
            <p className="text-[11px] text-ink/45 mt-1.5">
              Se pre-completa cuando el cliente toca el botón flotante de WhatsApp.
            </p>
          </div>
        </div>
      </fieldset>

      {/* ── Dirección ── */}
      <fieldset className="bg-cream-100 border border-ink/10 rounded-xl p-5 md:p-6">
        <legend className="px-2 text-[10px] uppercase tracking-[0.2em] text-ink/50 flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5" />
          Dirección
        </legend>

        <div className="space-y-4 mt-2">
          <Field
            label="Calle y número"
            value={data.addressStreet}
            onChange={update("addressStreet")}
            placeholder="Av. Principal 123"
          />
          <Field
            label="Ciudad / País"
            value={data.addressCity}
            onChange={update("addressCity")}
            placeholder="Buenos Aires, Argentina"
          />
        </div>
      </fieldset>

      {/* ── Acciones ── */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <div className="text-sm">
          {status === "saved"  && <span className="text-emerald-700">✓ Cambios guardados.</span>}
          {status === "error"  && <span className="text-red-700">{errorMsg}</span>}
          {status === "idle"   && <span className="text-ink/40">Los cambios se reflejan al instante en el sitio.</span>}
          {status === "saving" && <span className="text-ink/55">Guardando…</span>}
        </div>

        <button
          type="submit"
          disabled={status === "saving"}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-ink text-cream-100 text-[11px] uppercase tracking-[0.2em] font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02]"
        >
          <Save className="h-3.5 w-3.5" />
          {status === "saving" ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

/* ── Helper field ── */
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
