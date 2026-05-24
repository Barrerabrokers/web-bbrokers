"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";

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
      className="relative py-20 md:py-28 lg:py-36 bg-cream-900 text-cream-100 border-t border-ink/15"
    >
      <div className="container-custom">
        {/* Editorial header */}
        <div className="flex items-baseline justify-between flex-wrap gap-6 pb-12 border-b border-cream-100/15 mb-16 md:mb-20">
          <div className="flex items-baseline gap-6 md:gap-10">
            <span className="font-display italic font-light text-3xl md:text-4xl text-cream-100/40">
              (05)
            </span>
            <h2 className="font-display font-light text-4xl md:text-6xl lg:text-7xl tracking-[-0.025em] leading-[1] text-cream-100">
              <span className="italic">Contacto</span>
            </h2>
          </div>
          <p className="text-cream-100/70 leading-relaxed text-base md:text-lg max-w-md">
            Comencemos a trabajar juntos. Hablemos sobre tu proximo proyecto
            inmobiliario.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-8 md:gap-12">
          {/* Left - big email link + info */}
          <div className="col-span-12 md:col-span-5 space-y-12">
            <a
              href="mailto:info@barrerabrokers.com"
              className="group block"
            >
              <div className="text-[11px] uppercase tracking-widest text-cream-100/50 mb-4">
                (Escribinos)
              </div>
              <div className="font-display font-light text-3xl md:text-4xl lg:text-5xl tracking-[-0.025em] inline-flex items-baseline gap-3 group-hover:text-accent-300 transition-colors leading-[1.05]">
                info@barrerabrokers.com
                <ArrowUpRight className="h-6 w-6 md:h-8 md:w-8 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </div>
            </a>

            <div className="grid grid-cols-2 gap-y-8 gap-x-6 pt-8 border-t border-cream-100/15">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-cream-100/50 mb-2">
                  (Direccion)
                </div>
                <p className="text-cream-100/85 text-base leading-relaxed">
                  Av. Principal 123
                  <br />
                  Buenos Aires
                </p>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-widest text-cream-100/50 mb-2">
                  (Telefono)
                </div>
                <a
                  href="tel:+541112345678"
                  className="text-cream-100/85 text-base hover:text-cream-100 transition-colors"
                >
                  +54 11 1234-5678
                </a>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-widest text-cream-100/50 mb-2">
                  (Lun a Vie)
                </div>
                <p className="text-cream-100/85 text-base">9 - 19hs</p>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-widest text-cream-100/50 mb-2">
                  (Sabado)
                </div>
                <p className="text-cream-100/85 text-base">10 - 14hs</p>
              </div>
            </div>
          </div>

          {/* Right - form */}
          <div className="col-span-12 md:col-span-6 md:col-start-7">
            <form onSubmit={handleSubmit} className="space-y-7">
              <div>
                <label
                  htmlFor="name"
                  className="block text-[10px] uppercase tracking-widest text-cream-100/50 mb-3"
                >
                  Nombre
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full bg-transparent border-b border-cream-100/30 text-cream-100 placeholder-cream-100/30 px-0 py-3 text-base focus:outline-none focus:border-cream-100 hover:border-cream-100/60 transition-colors"
                  placeholder="Tu nombre completo"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-[10px] uppercase tracking-widest text-cream-100/50 mb-3"
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full bg-transparent border-b border-cream-100/30 text-cream-100 placeholder-cream-100/30 px-0 py-3 text-base focus:outline-none focus:border-cream-100 hover:border-cream-100/60 transition-colors"
                    placeholder="tu@email.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="block text-[10px] uppercase tracking-widest text-cream-100/50 mb-3"
                  >
                    Telefono
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full bg-transparent border-b border-cream-100/30 text-cream-100 placeholder-cream-100/30 px-0 py-3 text-base focus:outline-none focus:border-cream-100 hover:border-cream-100/60 transition-colors"
                    placeholder="+54 11 1234-5678"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="block text-[10px] uppercase tracking-widest text-cream-100/50 mb-3"
                >
                  Mensaje
                </label>
                <textarea
                  id="message"
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                  className="w-full bg-transparent border-b border-cream-100/30 text-cream-100 placeholder-cream-100/30 px-0 py-3 text-base focus:outline-none focus:border-cream-100 hover:border-cream-100/60 transition-colors resize-none"
                  placeholder="Contanos como podemos ayudarte..."
                />
              </div>

              {status === "success" && (
                <div className="text-sm text-cream-100/90 border-l-2 border-cream-100 pl-4 py-2">
                  Mensaje enviado. Te contactaremos pronto.
                </div>
              )}

              {status === "error" && (
                <div className="text-sm text-accent-200 border-l-2 border-accent pl-4 py-2">
                  Hubo un error. Por favor intenta nuevamente.
                </div>
              )}

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="btn-outline-light disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === "loading" ? "Enviando..." : "Enviar mensaje"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
