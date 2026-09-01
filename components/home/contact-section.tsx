"use client";

import { useState } from "react";
import { useSiteSettings } from "@/lib/use-site-settings";
import { SocialLinks } from "@/components/social-links";

/**
 * Contacto section — accent background con form.
 */
export function ContactSection() {
  const settings = useSiteSettings();
  const telLink = `tel:+${settings.whatsapp.replace(/[^\d]/g, "")}`;
  const city = settings.addressCity.split(",")[0].trim();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    interestZone: "",
    message: "",
  });
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const inputClassName =
    "w-full rounded-[10px] border border-[#151415]/18 bg-white/76 px-4 py-3.5 text-base text-[#151415] shadow-[0_8px_22px_rgba(58,29,23,0.06)] placeholder:text-[#151415]/42 transition-colors duration-300 hover:border-[#151415]/36 focus:border-[#151415] focus:bg-white focus:outline-none";
  const labelClassName =
    "mb-2.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-[#151415]/72";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const message = [
        formData.interestZone
          ? `Zona de interes: ${formData.interestZone}`
          : null,
        formData.message,
      ]
        .filter(Boolean)
        .join("\n\n");

      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          message,
        }),
      });

      if (response.ok) {
        setStatus("success");
        setFormData({ name: "", email: "", phone: "", interestZone: "", message: "" });
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
      className="relative overflow-hidden bg-[#EFE4D4] text-[#151415]"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-28"
        style={{
          background:
            "linear-gradient(180deg, rgba(21,20,21,0.08) 0%, rgba(21,20,21,0.025) 48%, rgba(21,20,21,0) 100%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(255,255,255,0.72),transparent_30%),radial-gradient(circle_at_82%_78%,rgba(122,82,60,0.15),transparent_34%)]" />

      <div className="relative z-10 section-pad pt-32 md:pt-40">
        <div className="container-custom">
          <div className="grid grid-cols-12 gap-6 mb-16 md:mb-24">
            <div className="col-span-12 md:col-span-1">
              <p className="font-display text-xl font-light italic text-[#151415]/45 md:text-2xl">
                05
              </p>
            </div>
            <div className="col-span-12 md:col-span-10 md:col-start-3 text-center md:text-left">
              <p className="mb-6 text-[11px] font-medium uppercase tracking-widest text-[#151415]/68">
                Contacto
              </p>
              <h2 className="max-w-5xl font-display text-[44px] font-light leading-[0.96] tracking-[-0.025em] text-[#151415] md:text-[80px] lg:text-[100px]">
                Hablemos de tu proximo{" "}
                <span className="italic">proyecto.</span>
              </h2>
              <p className="mt-8 max-w-2xl text-base leading-relaxed text-[#151415]/78 md:text-lg">
                Sea cual sea tu objetivo, dejanos tus datos y te
                contactamos a la brevedad. Tambien podes escribirnos por
                email o llamarnos directo.
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="grid grid-cols-12 gap-6">
              <div className="col-span-12 md:col-span-6">
                <label className={labelClassName}>
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className={inputClassName}
                  placeholder="Tu nombre completo"
                />
              </div>

              <div className="col-span-12 md:col-span-6">
                <label className={labelClassName}>
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className={inputClassName}
                  placeholder="tu@email.com"
                />
              </div>

              <div className="col-span-12 md:col-span-6">
                <label className={labelClassName}>
                  Telefono
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className={inputClassName}
                  placeholder="+54 11 1234-5678"
                />
              </div>

              <div className="col-span-12 md:col-span-6">
                <label className={labelClassName}>
                  Zona de interes
                </label>
                <input
                  type="text"
                  value={formData.interestZone}
                  onChange={(e) =>
                    setFormData({ ...formData, interestZone: e.target.value })
                  }
                  className={inputClassName}
                  placeholder="Palermo, Belgrano, etc."
                />
              </div>

              <div className="col-span-12 mt-4">
                <label className={labelClassName}>
                  Tu consulta
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                  className={`${inputClassName} resize-none`}
                  placeholder="Contanos como podemos ayudarte..."
                />
              </div>

              {status === "success" && (
                <div className="col-span-12 border-l-2 border-[#151415] py-2 pl-4 text-sm font-medium text-[#151415]">
                  Mensaje recibido. Te contactamos pronto.
                </div>
              )}

              {status === "error" && (
                <div className="col-span-12 border-l-2 border-red-700 py-2 pl-4 text-sm font-medium text-[#151415]">
                  Hubo un error. Por favor intenta nuevamente.
                </div>
              )}

              <div className="col-span-12 mt-8 flex justify-center">
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="relative inline-flex min-w-[260px] items-center justify-center gap-2 rounded-[8px] bg-[#151415] px-8 py-4 pb-5 text-[11px] font-medium uppercase tracking-widest text-[#F8F5EF] shadow-[0_14px_34px_rgba(21,20,21,0.18)] transition-all duration-500 hover:bg-[#2E2D2E] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ transitionTimingFunction: "var(--f-cubic)" }}
                >
                  {status === "loading" ? "Enviando..." : "Enviar consulta"}
                  <span className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#D8C4AF]" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Direct contact info */}
      <div className="relative z-10 border-t border-[#151415]/14 bg-[#F8F5EF]/35 py-12">
        <div className="container-custom">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-[#151415]/62">
                Email
              </p>
              <a
                href={`mailto:${settings.email}`}
                className="font-display text-base text-[#151415] transition-colors duration-300 hover:text-[#7A523C] md:text-lg"
              >
                {settings.email}
              </a>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-[#151415]/62">
                Telefono
              </p>
              <a
                href={telLink}
                className="font-display text-base text-[#151415] transition-colors duration-300 hover:text-[#7A523C] md:text-lg"
              >
                {settings.phone}
              </a>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-[#151415]/62">
                Direccion
              </p>
              <p className="text-sm leading-relaxed text-[#151415]">
                {settings.addressStreet}
                <br />
                {city}
              </p>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-[#151415]/62">
                Horario
              </p>
              <p className="text-sm leading-relaxed text-[#151415]">
                Lun-Vie 9-19hs
                <br />
                Sab 10-14hs
              </p>
            </div>
            <div className="col-span-2 md:col-span-1">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-[#151415]/62">
                Redes
              </p>
              <SocialLinks variant="dark" compact />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
