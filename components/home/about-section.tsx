import Image from "next/image";
import { User } from "lucide-react";
import { getTeamMembers } from "@/lib/db";

const values = [
  {
    no: "01",
    title: "Trayectoria",
    description: "Más de 25 años operando en Buenos Aires, con conocimiento profundo de cada barrio y tipología de propiedad.",
  },
  {
    no: "02",
    title: "Equipo",
    description: "Profesionales matriculados, especialistas en venta, alquiler, desarrollos e inversiones, trabajando en coordinación.",
  },
  {
    no: "03",
    title: "Atención",
    description: "Cada cliente recibe asesoramiento personalizado, desde la primera visita hasta la firma de la escritura o el contrato.",
  },
];

export async function AboutSection() {
  const team = await getTeamMembers();

  return (
    <section
      id="nosotros"
      style={{ backgroundColor: "var(--oa-bg-cream)" }}
    >
      {/* ── ABOUT ── */}
      <div
        className="section-pad"
        style={{ borderTop: "1px solid rgba(7,7,7,0.07)" }}
      >
        <div className="container-custom">
          <div className="grid grid-cols-12 gap-6 md:gap-10 lg:gap-16 items-start">

            {/* ── Imagen inclinada ── */}
            <div className="col-span-12 md:col-span-7 order-2 md:order-1">
              <div
                className="relative aspect-[4/5] overflow-hidden img-tilted"
                style={{
                  backgroundColor: "var(--oa-bg-light)",
                  borderRadius: "14px",
                }}
              >
                <Image
                  src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=90"
                  alt="Equipo Barrera Brokers"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 60vw"
                />
                {/* Overlay warm tint */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: "rgba(184,157,135,0.15)",
                    mixBlendMode: "multiply",
                  }}
                />
              </div>
              <div
                className="mt-3 flex items-baseline justify-between text-[9px] uppercase tracking-[0.2em]"
                style={{ color: "rgba(7,7,7,0.4)", fontFamily: "var(--font-sans)" }}
              >
                <span>Buenos Aires</span>
                <span>Est. 2000</span>
              </div>
            </div>

            {/* ── Texto ── */}
            <div className="col-span-12 md:col-span-4 md:col-start-9 order-1 md:order-2 flex flex-col gap-12">
              <div>
                <div className="flex items-baseline gap-3 mb-6">
                  <span
                    className="font-display italic font-light text-xl"
                    style={{ color: "rgba(7,7,7,0.2)" }}
                  >
                    05
                  </span>
                  <p
                    className="label-tracking"
                    style={{ color: "var(--oa-brown)" }}
                  >
                    Nosotros
                  </p>
                </div>

                <h3
                  className="font-display font-light leading-[1] tracking-[-0.04em] mb-8"
                  style={{
                    fontSize: "clamp(2.2rem, 4vw, 3.5rem)",
                    color: "var(--oa-black)",
                  }}
                >
                  Una inmobiliaria{" "}
                  <em className="not-italic" style={{ color: "var(--oa-brown)" }}>
                    independiente
                  </em>
                </h3>
                <p
                  className="text-base leading-relaxed"
                  style={{ color: "rgba(7,7,7,0.6)", fontFamily: "var(--font-sans)" }}
                >
                  Nacimos en el año 2000 con la idea de ofrecer un servicio
                  inmobiliario claro, profesional y centrado en cada cliente.
                  Hoy, más de dos décadas después, seguimos con el mismo
                  equipo y la misma forma de trabajar.
                </p>
              </div>

              <div style={{ borderTop: "1px solid rgba(7,7,7,0.08)" }} className="pt-6">
                <div
                  className="font-display font-light leading-none tracking-[-0.05em]"
                  style={{ fontSize: "clamp(4rem, 7vw, 7rem)", color: "var(--oa-black)" }}
                >
                  +500
                </div>
                <div
                  className="mt-2 text-[9px] uppercase tracking-[0.2em]"
                  style={{ color: "rgba(7,7,7,0.4)", fontFamily: "var(--font-sans)" }}
                >
                  Operaciones realizadas
                </div>
              </div>

              <div style={{ borderTop: "1px solid rgba(7,7,7,0.08)" }} className="pt-6 space-y-6">
                {values.map((v) => (
                  <div key={v.no} className="flex gap-5">
                    <span
                      className="font-display italic font-light text-lg flex-shrink-0"
                      style={{ color: "var(--oa-brown)", opacity: 0.6 }}
                    >
                      {v.no}
                    </span>
                    <div>
                      <h4
                        className="font-display font-light text-xl mb-1 tracking-tight"
                        style={{ color: "var(--oa-black)" }}
                      >
                        {v.title}
                      </h4>
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: "rgba(7,7,7,0.55)", fontFamily: "var(--font-sans)" }}
                      >
                        {v.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── EQUIPO ── */}
      <div
        className="section-pad"
        style={{
          backgroundColor: "var(--oa-white)",
          borderTop: "1px solid rgba(7,7,7,0.07)",
        }}
      >
        <div className="container-custom">
          <div className="grid grid-cols-12 gap-6 mb-12 md:mb-16">
            <div className="col-span-12 md:col-span-1">
              <p
                className="font-display italic font-light text-xl md:text-2xl"
                style={{ color: "rgba(7,7,7,0.18)" }}
              >
                06
              </p>
            </div>
            <div className="col-span-12 md:col-span-10 md:col-start-3">
              <p
                className="label-tracking mb-4"
                style={{ color: "rgba(7,7,7,0.4)" }}
              >
                Equipo
              </p>
              <h2
                className="font-display font-light tracking-[-0.04em] leading-[0.92]"
                style={{
                  fontSize: "clamp(2.5rem, 7vw, 7.5rem)",
                  color: "var(--oa-black)",
                }}
              >
                Las personas{" "}
                <em className="not-italic" style={{ color: "var(--oa-brown)" }}>
                  detrás
                </em>{" "}
                de cada operación.
              </h2>
            </div>
          </div>

          {team.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-12">
              {team.map((member, idx) => (
                <div key={member.id} className="group">
                  <div
                    className="relative aspect-[3/4] overflow-hidden mb-4 img-tilted"
                    style={{
                      backgroundColor: "var(--oa-bg-light)",
                      borderRadius: "12px",
                    }}
                  >
                    {member.photo ? (
                      <Image
                        src={member.photo}
                        alt={member.name}
                        fill
                        className="object-cover transition-transform duration-1000 group-hover:scale-[1.04]"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="h-16 w-16" style={{ color: "rgba(7,7,7,0.2)" }} />
                      </div>
                    )}
                  </div>
                  <div
                    className="pt-3"
                    style={{ borderTop: "1px solid rgba(7,7,7,0.08)" }}
                  >
                    <div className="flex items-baseline gap-2 mb-1">
                      <span
                        className="font-display italic font-light text-base"
                        style={{ color: "var(--oa-brown)", opacity: 0.5 }}
                      >
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <h4
                        className="font-display font-light text-xl leading-tight tracking-tight"
                        style={{ color: "var(--oa-black)" }}
                      >
                        {member.name}
                      </h4>
                    </div>
                    <p
                      className="text-[9px] uppercase tracking-[0.18em]"
                      style={{ color: "rgba(7,7,7,0.45)", fontFamily: "var(--font-sans)" }}
                    >
                      {member.title || (member.role === "admin" ? "Administrador" : "Agente")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <p
                className="text-lg"
                style={{ color: "rgba(7,7,7,0.4)", fontFamily: "var(--font-sans)" }}
              >
                Pronto vas a conocer a nuestro equipo.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
