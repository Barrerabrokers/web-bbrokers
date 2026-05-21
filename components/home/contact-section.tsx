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
    } catch (error) {
      setStatus("error");
    }
  };

  return (
    <section id="contacto" className="bg-charcoal-900 text-white py-24 md:py-32">
      <div className="container-custom">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Left - Info */}
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="h-px w-12 bg-gold-400" />
              <span className="label-tracking text-gold-400">
                Contáctanos
              </span>
            </div>
            
            <h2 className="heading-serif text-4xl md:text-5xl lg:text-6xl mb-8 leading-tight">
              Comencemos a
              <br />
              <span className="italic text-gold-400">trabajar juntos</span>
            </h2>
            
            <p className="text-white/60 text-lg leading-relaxed font-light mb-12">
              Sea cual sea tu objetivo, nuestro equipo está listo para acompañarte
              con asesoramiento personalizado y discreto.
            </p>

            {/* Contact Info */}
            <div className="space-y-8 pt-8 border-t border-white/10">
              <div>
                <div className="label-tracking text-gold-400 mb-2">Dirección</div>
                <p className="text-white/80 font-light">
                  Av. Principal 123<br />
                  Buenos Aires, Argentina
                </p>
              </div>
              
              <div>
                <div className="label-tracking text-gold-400 mb-2">Teléfono</div>
                <a href="tel:+541112345678" className="text-white/80 font-light hover:text-gold-400 transition-colors">
                  +54 11 1234-5678
                </a>
              </div>
              
              <div>
                <div className="label-tracking text-gold-400 mb-2">Email</div>
                <a href="mailto:info@barrerabrokers.com" className="text-white/80 font-light hover:text-gold-400 transition-colors">
                  info@barrerabrokers.com
                </a>
              </div>

              <div>
                <div className="label-tracking text-gold-400 mb-2">Horarios</div>
                <p className="text-white/80 font-light">
                  Lunes a Viernes: 9:00 - 19:00<br />
                  Sábados: 10:00 - 14:00
                </p>
              </div>
            </div>
          </div>

          {/* Right - Form */}
          <div>
            <form onSubmit={handleSubmit} className="space-y-8">
              <div>
                <label htmlFor="name" className="label-tracking text-gold-400 block mb-3">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-transparent border-b border-white/30 py-3 text-white focus:border-gold-400 focus:outline-none transition-colors font-light"
                  placeholder="Tu nombre"
                />
              </div>

              <div>
                <label htmlFor="email" className="label-tracking text-gold-400 block mb-3">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-transparent border-b border-white/30 py-3 text-white focus:border-gold-400 focus:outline-none transition-colors font-light"
                  placeholder="tu@email.com"
                />
              </div>

              <div>
                <label htmlFor="phone" className="label-tracking text-gold-400 block mb-3">
                  Teléfono
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-transparent border-b border-white/30 py-3 text-white focus:border-gold-400 focus:outline-none transition-colors font-light"
                  placeholder="+54 11 1234-5678"
                />
              </div>

              <div>
                <label htmlFor="message" className="label-tracking text-gold-400 block mb-3">
                  Mensaje
                </label>
                <textarea
                  id="message"
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-transparent border-b border-white/30 py-3 text-white focus:border-gold-400 focus:outline-none transition-colors font-light resize-none"
                  placeholder="Cuéntanos cómo podemos ayudarte..."
                />
              </div>

              {status === "success" && (
                <div className="border border-gold-400 text-gold-400 px-6 py-4 label-tracking">
                  Mensaje enviado. Te contactaremos pronto.
                </div>
              )}

              {status === "error" && (
                <div className="border border-red-400 text-red-400 px-6 py-4 label-tracking">
                  Hubo un error. Por favor intenta nuevamente.
                </div>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="btn-outline-light disabled:opacity-50 disabled:cursor-not-allowed mt-8"
              >
                {status === "loading" ? "Enviando..." : "Enviar Mensaje"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
