"use client";

import { useState } from "react";

interface PropertyInquiryFormProps {
  propertyId: string;
  propertyTitle: string;
  propertyLocation: string;
}

export function PropertyInquiryForm({
  propertyId,
  propertyTitle,
  propertyLocation,
}: PropertyInquiryFormProps) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");

    try {
      const message = [
        `Consulta por propiedad: ${propertyTitle}`,
        `Ubicacion: ${propertyLocation}`,
        "",
        form.message || "Me gustaria recibir mas informacion.",
      ].join("\n");

      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          message,
          propertyId,
        }),
      });

      if (!response.ok) throw new Error("No se pudo enviar");

      setStatus("success");
      setForm({ name: "", email: "", phone: "", message: "" });
      setTimeout(() => setStatus("idle"), 5000);
    } catch {
      setStatus("error");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="mb-2 block text-[10px] uppercase tracking-widest text-ink/55">
          Nombre
        </label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          className="form-input"
          placeholder="Tu nombre"
        />
      </div>

      <div>
        <label className="mb-2 block text-[10px] uppercase tracking-widest text-ink/55">
          Email
        </label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          className="form-input"
          placeholder="tu@email.com"
        />
      </div>

      <div>
        <label className="mb-2 block text-[10px] uppercase tracking-widest text-ink/55">
          Telefono
        </label>
        <input
          type="tel"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
          className="form-input"
          placeholder="+54 11 1234-5678"
        />
      </div>

      <div>
        <label className="mb-2 block text-[10px] uppercase tracking-widest text-ink/55">
          Mensaje
        </label>
        <textarea
          rows={4}
          value={form.message}
          onChange={(event) => setForm({ ...form, message: event.target.value })}
          className="form-input resize-none"
          placeholder="Me gustaria mas informacion..."
        />
      </div>

      {status === "success" && (
        <p className="border-l-2 border-emerald-700 py-2 pl-4 text-sm font-medium text-ink">
          Consulta recibida. Te contactaremos pronto.
        </p>
      )}

      {status === "error" && (
        <p className="border-l-2 border-red-700 py-2 pl-4 text-sm font-medium text-ink">
          No pudimos enviar la consulta. Probá nuevamente o escribinos por WhatsApp.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="btn-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-55"
      >
        {status === "loading" ? "Enviando..." : "Enviar consulta"}
      </button>
    </form>
  );
}
