"use client";

import { useState } from "react";
import { Mail, Phone, MapPin, Clock } from "lucide-react";

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
      className="relative py-24 md:py-32 lg:py-40 bg-white border-t border-ink/10"
    >
      <div className="container-custom">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
          <span className="eyebrow mb-6">Get in Touch</span>
          <h2 className="lp-h2 mt-6 mb-6">
            Hablemos de tu <span className="italic">proximo paso.</span>
          </h2>
          <p className="text-ink/65 text-base md:text-lg leading-relaxed">
            Sea cual sea tu objetivo, nuestro equipo esta listo para
            acompanarte con asesoramiento personalizado y discreto.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Left - Info */}
          <div className="space-y-10">
            <div className="grid sm:grid-cols-2 gap-8">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-accent">
                  <Mail className="h-4 w-4" />
                  <span className="text-[10px] uppercase tracking-widest">
                    Email
                  </span>
                </div>
                <a
                  href="mailto:info@barrerabrokers.com"
                  className="block font-display text-2xl text-ink hover:text-accent transition-colors leading-tight"
                >
                  info@barrerabrokers.com
                </a>
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-accent">
                  <Phone className="h-4 w-4" />
                  <span className="text-[10px] uppercase tracking-widest">
                    Telefono
                  </span>
                </div>
                <a
                  href="tel:+541112345678"
                  className="block font-display text-2xl text-ink hover:text-accent transition-colors leading-tight"
                >
                  +54 11 1234-5678
                </a>
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-accent">
                  <MapPin className="h-4 w-4" />
                  <span className="text-[10px] uppercase tracking-widest">
                    Oficina
                  </span>
                </div>
                <p className="text-ink text-base leading-relaxed">
                  Av. Principal 123
                  <br />
                  Buenos Aires, Argentina
                </p>
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-accent">
                  <Clock className="h-4 w-4" />
                  <span className="text-[10px] uppercase tracking-widest">
                    Horario
                  </span>
                </div>
                <p className="text-ink text-base leading-relaxed">
                  Lun a Vie 9-19hs
                  <br />
                  Sab 10-14hs
                </p>
              </div>
            </div>

            <div className="pt-10 border-t border-ink/10">
              <p className="font-display italic text-2xl md:text-3xl text-ink leading-tight">
                &ldquo;Hace mas de dos decadas que conectamos a las personas
                indicadas con las propiedades que cambian sus vidas.&rdquo;
              </p>
              <p className="mt-4 text-[11px] uppercase tracking-widest text-ink/55">
                — Maria Barrera, CEO &amp; Fundadora
              </p>
            </div>
          </div>

          {/* Right - Form */}
          <div className="lg:pl-8">
            <form onSubmit={handleSubmit} className="space-y-7">
              <div>
                <label
                  htmlFor="name"
                  className="block text-[10px] uppercase tracking-widest text-ink/55 mb-3"
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
                  className="form-input"
                  placeholder="Tu nombre completo"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-[10px] uppercase tracking-widest text-ink/55 mb-3"
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
                    className="form-input"
                    placeholder="tu@email.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="block text-[10px] uppercase tracking-widest text-ink/55 mb-3"
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
                    className="form-input"
                    placeholder="+54 11 1234-5678"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="block text-[10px] uppercase tracking-widest text-ink/55 mb-3"
                >
                  Mensaje
                </label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  value={formData.message}
                  onChange={(e) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                  className="form-input resize-none"
                  placeholder="Contanos como podemos ayudarte..."
                />
              </div>

              {status === "success" && (
                <div className="text-sm text-ink border-l-2 border-accent pl-4 py-2">
                  Mensaje enviado. Te contactaremos pronto.
                </div>
              )}

              {status === "error" && (
                <div className="text-sm text-ink border-l-2 border-red-500 pl-4 py-2">
                  Hubo un error. Por favor intenta nuevamente.
                </div>
              )}

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
