"use client";

import { useState } from "react";
import { ArrowRight, MapPin, Phone, Mail, Clock } from "lucide-react";

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
      className="relative section-pad bg-gray-950 overflow-hidden"
    >
      <div className="absolute inset-0 -z-10 bg-glow-accent" />

      <div className="container-custom">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Left - Info */}
          <div>
            <span className="eyebrow mb-5">Contacto</span>

            <h2 className="mt-5 text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tightest leading-[1.05] mb-6">
              <span className="text-gradient">Comencemos a</span>{" "}
              <span className="text-gradient-accent">trabajar juntos.</span>
            </h2>

            <p className="text-gray-400 text-lg leading-relaxed tracking-tight mb-10 max-w-md">
              Sea cual sea tu objetivo, nuestro equipo esta listo para
              acompanarte con asesoramiento personalizado y discreto.
            </p>

            {/* Contact Info Grid */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-2 text-accent-300">
                  <MapPin className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-widest">
                    Direccion
                  </span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">
                  Av. Principal 123
                  <br />
                  Buenos Aires, Argentina
                </p>
              </div>

              <div className="card p-5">
                <div className="flex items-center gap-2 mb-2 text-accent-300">
                  <Phone className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-widest">
                    Telefono
                  </span>
                </div>
                <a
                  href="tel:+541112345678"
                  className="text-sm text-gray-300 hover:text-gray-50 transition-colors"
                >
                  +54 11 1234-5678
                </a>
              </div>

              <div className="card p-5">
                <div className="flex items-center gap-2 mb-2 text-accent-300">
                  <Mail className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-widest">
                    Email
                  </span>
                </div>
                <a
                  href="mailto:info@barrerabrokers.com"
                  className="text-sm text-gray-300 hover:text-gray-50 transition-colors break-all"
                >
                  info@barrerabrokers.com
                </a>
              </div>

              <div className="card p-5">
                <div className="flex items-center gap-2 mb-2 text-accent-300">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-widest">
                    Horario
                  </span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">
                  Lun a Vie 9-19hs
                  <br />
                  Sab 10-14hs
                </p>
              </div>
            </div>
          </div>

          {/* Right - Form */}
          <div>
            <form
              onSubmit={handleSubmit}
              className="card p-8 space-y-5 backdrop-blur-md bg-gray-900/80"
            >
              <div>
                <label
                  htmlFor="name"
                  className="block text-xs font-medium tracking-tight text-gray-300 mb-2"
                >
                  Nombre completo
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
                  placeholder="Tu nombre"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-medium tracking-tight text-gray-300 mb-2"
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
                    className="block text-xs font-medium tracking-tight text-gray-300 mb-2"
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
                  className="block text-xs font-medium tracking-tight text-gray-300 mb-2"
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
                <div className="rounded-md border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent-300">
                  Mensaje enviado. Te contactaremos pronto.
                </div>
              )}

              {status === "error" && (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  Hubo un error. Por favor intenta nuevamente.
                </div>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="btn-accent w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "loading" ? (
                  <>Enviando...</>
                ) : (
                  <>
                    Enviar mensaje
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
