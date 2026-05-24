"use client";

import { useState } from "react";

/**
 * Admission / Contact section - Obsidian Assembly style
 * Yellow background with form on top of dark gradient.
 * "Admission" / private inquiry feel.
 */
export function ContactSection() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

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
    } catch (error) {
      setStatus("error");
    }
  };

  return (
    <section
      id="contacto"
      className="relative bg-accent text-ink overflow-hidden"
    >
      {/* Top gradient overlay (Obsidian Assembly admission section trick) */}
      <div
        className="absolute inset-x-0 top-0 h-32 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(26,24,20,1) 0%, rgba(26,24,20,0.5) 50%, rgba(26,24,20,0) 100%)",
        }}
      />

      <div className="relative z-10 section-pad pt-32 md:pt-40">
        <div className="container-custom">
          {/* Big title with mask fade */}
          <div className="text-center mb-16 md:mb-24">
            <p className="font-display italic font-light text-2xl md:text-3xl text-ink/55 mb-6">
              Admission
            </p>
            <h2 className="font-display font-light text-[44px] md:text-[88px] lg:text-[120px] tracking-[-0.025em] leading-[0.96] text-ink max-w-5xl mx-auto">
              El acceso es <span className="italic">considerado,</span>
              <br />
              no asumido.
            </h2>
            <p className="mt-8 max-w-2xl mx-auto text-ink/75 text-base md:text-lg leading-relaxed">
              Si queres saber mas sobre nuestras propiedades disponibles o
              tenes una operacion en mente, dejanos tus datos. Nos pondremos
              en contacto.
            </p>
          </div>

          {/* Form */}
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="grid grid-cols-12 gap-6">
              <div className="col-span-12 md:col-span-6">
                <label className="block text-[10px] uppercase tracking-widest text-ink/55 mb-3">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full bg-transparent border-b border-ink/30 text-ink placeholder-ink/40 px-0 py-3 text-base focus:outline-none focus:border-ink hover:border-ink/60 transition-colors duration-300"
                  placeholder="Tu nombre completo"
                />
              </div>

              <div className="col-span-12 md:col-span-6">
                <label className="block text-[10px] uppercase tracking-widest text-ink/55 mb-3">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full bg-transparent border-b border-ink/30 text-ink placeholder-ink/40 px-0 py-3 text-base focus:outline-none focus:border-ink hover:border-ink/60 transition-colors duration-300"
                  placeholder="tu@email.com"
                />
              </div>

              <div className="col-span-12 md:col-span-6">
                <label className="block text-[10px] uppercase tracking-widest text-ink/55 mb-3">
                  Telefono
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full bg-transparent border-b border-ink/30 text-ink placeholder-ink/40 px-0 py-3 text-base focus:outline-none focus:border-ink hover:border-ink/60 transition-colors duration-300"
                  placeholder="+54 11 1234-5678"
                />
              </div>

              <div className="col-span-12 md:col-span-6">
                <label className="block text-[10px] uppercase tracking-widest text-ink/55 mb-3">
                  Ciudad
                </label>
                <input
                  type="text"
                  className="w-full bg-transparent border-b border-ink/30 text-ink placeholder-ink/40 px-0 py-3 text-base focus:outline-none focus:border-ink hover:border-ink/60 transition-colors duration-300"
                  placeholder="Buenos Aires"
                />
              </div>

              <div className="col-span-12 mt-4">
                <label className="block text-[10px] uppercase tracking-widest text-ink/55 mb-3">
                  Contanos
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                  className="w-full bg-transparent border-b border-ink/30 text-ink placeholder-ink/40 px-0 py-3 text-base focus:outline-none focus:border-ink hover:border-ink/60 transition-colors duration-300 resize-none"
                  placeholder="En que estas pensando..."
                />
              </div>

              {status === "success" && (
                <div className="col-span-12 text-sm text-ink border-l-2 border-ink pl-4 py-2">
                  Mensaje recibido. Vamos a contactarte pronto.
                </div>
              )}

              {status === "error" && (
                <div className="col-span-12 text-sm text-ink border-l-2 border-red-700 pl-4 py-2">
                  Hubo un error. Por favor intenta nuevamente.
                </div>
              )}

              <div className="col-span-12 mt-8 flex justify-center">
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="relative inline-flex items-center justify-center gap-2 px-8 py-4 pb-5 bg-ink text-bone text-[11px] uppercase tracking-widest font-medium rounded-[6px] hover:bg-ink-600 transition-all duration-900 disabled:opacity-50 disabled:cursor-not-allowed min-w-[260px]"
                  style={{ transitionTimingFunction: "var(--f-cubic)" }}
                >
                  {status === "loading" ? "Enviando..." : "Enviar consulta"}
                  <span className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Direct contact info bottom */}
      <div className="relative z-10 border-t border-ink/15 py-12">
        <div className="container-custom">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ink/55 mb-2">
                Email
              </p>
              <a
                href="mailto:info@barrerabrokers.com"
                className="font-display text-base md:text-lg text-ink hover:text-ink-600 transition-colors duration-300"
              >
                info@barrerabrokers.com
              </a>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ink/55 mb-2">
                Telefono
              </p>
              <a
                href="tel:+541112345678"
                className="font-display text-base md:text-lg text-ink hover:text-ink-600 transition-colors duration-300"
              >
                +54 11 1234-5678
              </a>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ink/55 mb-2">
                Direccion
              </p>
              <p className="text-sm text-ink leading-relaxed">
                Av. Principal 123
                <br />
                Buenos Aires
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-ink/55 mb-2">
                Horario
              </p>
              <p className="text-sm text-ink leading-relaxed">
                Lun-Vie 9-19hs
                <br />
                Sab 10-14hs
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
