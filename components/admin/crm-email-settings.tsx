"use client";

import { FormEvent, useState } from "react";
import { CalendarDays, CheckCircle2, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import type { CrmEmailAccount } from "@/lib/db";

type EmailSettingsForm = {
  provider: string;
  email: string;
  fromName: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  signature: string;
};

export function CrmEmailSettings({ account }: { account: CrmEmailAccount | null }) {
  const isGoogleOAuth = account?.provider === "google-oauth";
  const [form, setForm] = useState<EmailSettingsForm>({
    provider: account?.provider || "gmail",
    email: account?.email || "",
    fromName: account?.fromName || "",
    smtpHost: account?.smtpHost || "smtp.gmail.com",
    smtpPort: String(account?.smtpPort || 587),
    smtpSecure: account?.smtpSecure || false,
    smtpUser: account?.smtpUser || account?.email || "",
    smtpPassword: "",
    signature: account?.signature || "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const update =
    (field: keyof EmailSettingsForm) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target instanceof HTMLInputElement && event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
      setForm((current) => {
        if (field === "provider" && value === "gmail") {
          return {
            ...current,
            provider: "gmail",
            smtpHost: "smtp.gmail.com",
            smtpPort: "587",
            smtpSecure: false,
            smtpUser: current.email || current.smtpUser,
          };
        }
        return { ...current, [field]: value };
      });
      setNotice("");
      setError("");
    };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch("/api/crm/email/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          smtpHost: form.provider === "gmail" ? "smtp.gmail.com" : form.smtpHost,
          smtpPort: form.provider === "gmail" ? 587 : Number(form.smtpPort),
          smtpSecure: form.provider === "gmail" ? false : form.smtpSecure,
          smtpUser: form.provider === "gmail" ? form.email : form.smtpUser,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo conectar el correo.");
      }
      setNotice("Correo personal conectado.");
      setForm((current) => ({ ...current, smtpPassword: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar el correo.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-ink/12 bg-white p-6 text-ink">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-ink/45">
              CRM
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Correo personal</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink/62">
              Cada agente conecta su propia cuenta personal desde acá. Con Google conectado, el CRM
              puede enviar correos y crear reuniones o tareas en Google Calendar con los datos del cliente.
            </p>
          </div>
          <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-ink/12 bg-cream-100 px-4 text-sm font-medium text-ink/70">
            <Mail className="h-4 w-4 text-[#006b6b]" />
            {account ? `Conectado: ${account.email}` : "Sin Google conectado"}
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-[#006b6b]/18 bg-[#eef8f5] p-6 text-ink">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#006b6b]/70">
              Recomendado
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Conectar Gmail + Google Calendar
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/65">
              Autoriza una vez tu cuenta de Google. Desde ese momento el agente puede usar el CRM
              para enviar correos, preparar reuniones y ver su calendario embebido.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-ink/62">
              <span className="rounded-full bg-white px-3 py-1.5">Gmail enviar</span>
              <span className="rounded-full bg-white px-3 py-1.5">Gmail leer</span>
              <span className="rounded-full bg-white px-3 py-1.5">Calendar eventos</span>
              <span className="rounded-full bg-white px-3 py-1.5">Agenda embebida</span>
            </div>
          </div>
          <a
            href="/api/crm/google/connect"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#005c5c] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#004949]"
          >
            <CalendarDays className="h-4 w-4" />
            {isGoogleOAuth ? "Reconectar Google" : "Conectar Google"}
          </a>
        </div>
        {isGoogleOAuth && (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-800">
            Google esta conectado para {account.email}. Las reuniones y tareas se crean en Google Calendar.
          </p>
        )}
      </section>

      <form onSubmit={save} className="rounded-xl border border-ink/12 bg-white p-6">
        <div className="mb-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/45">
            Opcion alternativa
          </p>
          <h2 className="mt-1 text-xl font-semibold text-ink">Configurar SMTP manual</h2>
          <p className="mt-2 text-sm leading-6 text-ink/55">
            Usalo solo si no querés conectar Google OAuth. SMTP sirve para enviar, pero no sincroniza Calendar ni lectura de Gmail.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Proveedor">
            <select value={form.provider} onChange={update("provider")} className="form-input">
              <option value="gmail">Gmail</option>
              <option value="smtp">Otro SMTP</option>
            </select>
          </Field>
          <Field label="Email">
            <input
              value={form.email}
              onChange={(event) => {
                const value = event.target.value;
                setForm((current) => ({
                  ...current,
                  email: value,
                  smtpUser: current.provider === "gmail" || !current.smtpUser ? value : current.smtpUser,
                }));
              }}
              className="form-input"
              type="email"
              placeholder="pablo@gmail.com"
              required
            />
          </Field>
          <Field label="Nombre remitente">
            <input
              value={form.fromName}
              onChange={update("fromName")}
              className="form-input"
              placeholder="Pablo Barrera"
            />
          </Field>
          {form.provider !== "gmail" && (
            <>
              <Field label="Usuario SMTP">
                <input
                  value={form.smtpUser}
                  onChange={update("smtpUser")}
                  className="form-input"
                  placeholder="Normalmente el mismo email"
                  required
                />
              </Field>
              <Field label="Servidor SMTP">
                <input value={form.smtpHost} onChange={update("smtpHost")} className="form-input" required />
              </Field>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <Field label="Puerto">
                  <input
                    value={form.smtpPort}
                    onChange={update("smtpPort")}
                    className="form-input"
                    inputMode="numeric"
                    required
                  />
                </Field>
                <label className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg border border-ink/14 px-3 text-sm font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={form.smtpSecure}
                    onChange={update("smtpSecure")}
                    className="h-4 w-4 accent-[#006b6b]"
                  />
                  SSL
                </label>
              </div>
            </>
          )}
          {form.provider === "gmail" && (
            <div className="rounded-lg border border-ink/10 bg-cream-50 p-4 text-sm leading-6 text-ink/62 lg:col-span-2">
              Gmail por SMTP se configura automáticamente con <strong>smtp.gmail.com</strong>, pero
              para Calendar recomendamos el botón <strong>Conectar Google</strong>.
            </div>
          )}
          <Field label="Contraseña de aplicación">
            <div className="relative">
              <input
                value={form.smtpPassword}
                onChange={update("smtpPassword")}
                className="form-input pr-28"
                type={showPassword ? "text" : "password"}
                placeholder={form.provider === "gmail" ? "16 caracteres de Google" : "Contraseña SMTP"}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 inline-flex h-8 -translate-y-1/2 items-center gap-1.5 rounded-md border border-ink/12 bg-white px-2 text-xs font-medium text-ink transition-colors hover:bg-cream-100"
                aria-label={showPassword ? "Ocultar clave" : "Ver clave"}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showPassword ? "Ocultar" : "Ver clave"}
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink/52">
              {form.provider === "gmail"
                ? "En Gmail no uses tu contraseña normal. Generá una contraseña de aplicación en tu cuenta de Google y pegala acá; si aparece con espacios, el sistema los limpia."
                : "Usá la contraseña SMTP del proveedor del correo."}
            </p>
          </Field>
          <Field label="Firma">
            <textarea
              value={form.signature}
              onChange={update("signature")}
              className="form-input min-h-28"
              placeholder="Saludos,\nPablo Barrera\nBarrera Brokers"
            />
          </Field>
        </div>

        {error && (
          <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={isSaving}
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#005c5c] px-5 text-sm font-medium text-white transition-colors hover:bg-[#004949] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Conectar correo personal
        </button>
      </form>
    </div>
  );
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-tracking mb-2 block text-ink/70">{label}</span>
      {children}
    </label>
  );
}
