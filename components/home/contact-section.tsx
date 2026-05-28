"use client";

import { useState } from "react";

export function ContactSection() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setStatus("success");
        setFormData({ name: "", email: "", phone: "", message: "" });
        setTimeout(() => setStatus("idle"), 5000);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <section
      id="contacto"
      className="relative overflow-hidden"
      style={{ backgroundColor: "var(--oa-bg)" }}
    >
      {/* Grain */}
      <div className="absolute inset-0 bg-grain opacity-50 pointer-events-none" />

      {/* Círculos decorativos */}
      <div
        className="circle-deco"
        style={{
          width: "min(90vw, 800px)",
          height: "min(90vw, 800px)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          borderColor: "rgba(255,255,255,0.12)",
        }}
      />
      <div
        className="circle-deco"
        style={{
          width: "min(55vw, 480px)",
          height: "min(55vw, 480px)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      />

      <div className="relative z-10 section-pad">
        <div className="container-custom">

          {/* ── HEADER ── */}
          <div className="grid grid-cols-12 gap-6 mb-16 md:mb-24">
            <div className="col-span-12 md:col-span-1">
              <p
                className="font-display italic font-light text-xl md:text-2xl"
                style={{ color: "rgba(7,7,7,0.2)" }}
              >
                07
              </p>
            </div>
            <div className="col-span-12 md:col-span-10 md:col-start-3">
              <p
                className="label-tracking mb-6"
                style={{ color: "rgba(7,7,7,0.5)" }}
              >
                Contacto
              </p>
              <h2
                className="font-display font-light tracking-[-0.04em] leading-[0.92]"
                style={{
                  fontSize: "clamp(2.8rem, 8vw, 9rem)",
                  color: "var(--oa-black)",
                }}
              >
                Hablemos de tu próximo{" "}
                <em className="not-italic" style={{ color: "var(--oa-brown)" }}>
                  proyecto.
                </em>
              </h2>
              <p
                className="mt-8 max-w-2xl text-base leading-relaxed"
                style={{ color: "rgba(7,7,7,0.6)", fontFamily: "var(--font-sans)" }}
              >
                Sea cual sea tu objetivo, dejanos tus datos y te contactamos a la brevedad.
                También podés escribirnos por email o llamarnos directo.
              </p>
            </div>
          </div>

          {/* ── FORMULARIO ── */}
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="grid grid-cols-12 gap-6">
              {[
                { label: "Nombre",        id: "name",    type: "text",  placeholder: "Tu nombre completo",  span: 6, key: "name"    },
                { label: "Email",         id: "email",   type: "email", placeholder: "tu@email.com",         span: 6, key: "email"   },
                { label: "Teléfono",      id: "phone",   type: "tel",   placeholder: "+54 11 1234-5678",     span: 6, key: "phone"   },
                { label: "Zona de interés", id: "zone", type: "text",  placeholder: "Palermo, Belgrano…",   span: 6, key: null      },
              ].map((field) => (
                <div key={field.id} className={`col-span-12 md:col-span-${field.span}`}>
                  <label
                    className="block text-[9px] uppercase tracking-[0.2em] mb-3"
                    style={{ color: "rgba(7,7,7,0.5)", fontFamily: "var(--font-sans)" }}
                  >
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    required={field.key !== null && field.key !== "phone"}
                    value={field.key ? (formData as any)[field.key] ?? "" : ""}
                    onChange={(e) =>
                      field.key && setFormData({ ...formData, [field.key]: e.target.value })
                    }
                    className="input-dark"
                    placeholder={field.placeholder}
                  />
                </div>
              ))}

              <div className="col-span-12 mt-2">
                <label
                  className="block text-[9px] uppercase tracking-[0.2em] mb-3"
                  style={{ color: "rgba(7,7,7,0.5)", fontFamily: "var(--font-sans)" }}
                >
                  Tu consulta
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="input-dark resize-none"
                  placeholder="Contanos cómo podemos ayudarte…"
                />
              </div>

              {status === "success" && (
                <div
                  className="col-span-12 text-sm pl-4 py-2"
                  style={{
                    color: "rgba(7,7,7,0.7)",
                    borderLeft: "2px solid var(--oa-brown)",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  Mensaje recibido. Te contactamos pronto.
                </div>
              )}

              {status === "error" && (
                <div
                  className="col-span-12 text-sm pl-4 py-2"
                  style={{
                    color: "rgba(7,7,7,0.7)",
                    borderLeft: "2px solid #c0392b",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  Hubo un error. Por favor intentá nuevamente.
                </div>
              )}

              <div className="col-span-12 mt-6 flex justify-center">
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="relative inline-flex items-center justify-center gap-2 px-10 py-4 pb-5 rounded-lg text-[10px] uppercase tracking-[0.2em] font-medium transition-all duration-700 disabled:opacity-50 disabled:cursor-not-allowed min-w-[260px]"
                  style={{
                    background: "var(--oa-black)",
                    color: "var(--oa-white)",
                    fontFamily: "var(--font-sans)",
                    transitionTimingFunction: "var(--ease-out-expo)",
                  }}
                >
                  {status === "loading" ? "Enviando…" : "Enviar consulta"}
                  <span
                    className="absolute bottom-2 right-2.5 h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--oa-bg)" }}
                  />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ── INFO DIRECTA ── */}
      <div
        className="relative z-10 py-12"
        style={{ borderTop: "1px solid rgba(7,7,7,0.1)" }}
      >
        <div className="container-custom">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: "Email",     value: "info@barrerabrokers.com",  href: "mailto:info@barrerabrokers.com" },
              { label: "Teléfono",  value: "+54 11 1234-5678",          href: "tel:+541112345678"              },
              { label: "Dirección", value: "Av. Principal 123\nBuenos Aires" },
              { label: "Horario",   value: "Lun–Vie 9–19hs\nSáb 10–14hs"    },
            ].map((item) => (
              <div key={item.label}>
                <p
                  className="label-tracking mb-2"
                  style={{ color: "rgba(7,7,7,0.4)" }}
                >
                  {item.label}
                </p>
                {item.href ? (
                  <a
                    href={item.href}
                    className="font-display text-base md:text-lg transition-colors duration-300"
                    style={{ color: "var(--oa-black)" }}
                  >
                    {item.value}
                  </a>
                ) : (
                  <p
                    className="text-sm leading-relaxed whitespace-pre-line"
                    style={{ color: "var(--oa-black)", fontFamily: "var(--font-sans)" }}
                  >
                    {item.value}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
