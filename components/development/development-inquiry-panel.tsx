"use client";

import { useState } from "react";
import { ArrowUpRight, Check, MessageCircle } from "lucide-react";
import { useSiteSettings } from "@/lib/use-site-settings";

interface Props {
  developmentName: string;
  location: string;
}

export function DevelopmentInquiryPanel({ developmentName, location }: Props) {
  const settings = useSiteSettings();
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const whatsappNumber = settings.whatsapp.replace(/[^\d]/g, "");
  const message = `Hola, quiero recibir información sobre ${developmentName} en ${location}.`;
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("loading");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          message: `Consulta por el desarrollo ${developmentName}, ${location}.`,
        }),
      });
      if (!response.ok) throw new Error("No se pudo enviar");
      setStatus("success");
      setForm({ name: "", email: "", phone: "" });
    } catch {
      setStatus("error");
    }
  };

  const fieldClass =
    "w-full rounded-lg border border-ink/18 bg-[#F8F5EF]/75 px-3.5 py-3 text-base text-ink outline-none transition-colors placeholder:text-ink/55 hover:border-ink/35 focus:border-ink focus:bg-[#F8F5EF]";

  return (
    <aside className="rounded-xl bg-[#D8C4AF] p-5 text-ink md:p-7 lg:sticky lg:top-28">
      <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.16em] text-accent">
        Asesoramiento personal
      </p>
      <h2 className="max-w-sm font-display text-3xl font-light leading-[1.02] tracking-[-0.025em] md:text-4xl">
        Recibí disponibilidad y financiación.
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-ink/72">
        Dejanos tus datos y un asesor de Barrera Brokers te contactará con la información actualizada.
      </p>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 flex min-h-12 w-full items-center justify-between rounded-lg bg-ink px-4 py-3 text-sm font-medium text-bone transition-colors hover:bg-ink-600"
      >
        <span className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Consultar por WhatsApp
        </span>
        <ArrowUpRight className="h-4 w-4" />
      </a>

      <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.14em] text-ink/45">
        <span className="h-px flex-1 bg-ink/12" />
        o te llamamos
        <span className="h-px flex-1 bg-ink/12" />
      </div>

      <form onSubmit={submit} className="space-y-3.5">
        <input
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          className={fieldClass}
          placeholder="Nombre y apellido"
          aria-label="Nombre y apellido"
        />
        <input
          required
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          className={fieldClass}
          placeholder="Email"
          aria-label="Email"
        />
        <input
          type="tel"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
          className={fieldClass}
          placeholder="Teléfono"
          aria-label="Teléfono"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="flex min-h-12 w-full items-center justify-between rounded-lg border border-ink/20 px-4 py-3 text-sm font-medium transition-colors hover:border-ink hover:bg-ink/5 disabled:opacity-55"
        >
          {status === "loading" ? "Enviando..." : "Solicitar información"}
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </form>

      {status === "success" && (
        <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-800">
          <Check className="h-4 w-4" />
          Consulta recibida. Te contactaremos pronto.
        </p>
      )}
      {status === "error" && (
        <p className="mt-4 text-sm font-medium text-red-800">
          No pudimos enviar la consulta. Probá por WhatsApp.
        </p>
      )}
    </aside>
  );
}
