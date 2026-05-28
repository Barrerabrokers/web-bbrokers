import Link from "next/link";

export function Footer() {
  return (
    <footer style={{ backgroundColor: "var(--oa-brown)", color: "var(--oa-white)" }}>
      <div className="container-custom pt-20 pb-8">

        {/* ── WORDMARK GIGANTE ── */}
        <div className="mb-16 overflow-hidden">
          <Link href="/" className="inline-block group">
            <span
              className="block font-display font-light leading-[0.88] tracking-[-0.04em] transition-all duration-700 group-hover:italic"
              style={{
                fontSize: "clamp(3.5rem, 9vw, 10rem)",
                color: "var(--oa-white)",
                opacity: 0.92,
              }}
            >
              Barrera{" "}
              <em className="not-italic" style={{ color: "var(--oa-bg-light)" }}>
                Brokers
              </em>
            </span>
          </Link>
          <p
            className="mt-3 text-[9px] uppercase tracking-[0.22em]"
            style={{
              color: "rgba(248,245,239,0.3)",
              fontFamily: "var(--font-sans)",
            }}
          >
            Desarrollos inmobiliarios · Buenos Aires · Est. 2000
          </p>
        </div>

        {/* ── LÍNEA DIVISORIA ── */}
        <div className="line-h mb-14" />

        {/* ── GRID DE COLUMNAS ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-10">

          {/* Navegación */}
          <div>
            <h3
              className="label-tracking mb-5"
              style={{ color: "rgba(248,245,239,0.35)" }}
            >
              Navegación
            </h3>
            <ul className="space-y-3">
              {[
                { href: "/#desarrollos", label: "Desarrollos" },
                { href: "/#modelo",      label: "Inversión"   },
                { href: "/#renta",       label: "Renta temporaria" },
                { href: "/#propiedades", label: "Propiedades" },
                { href: "/#contacto",   label: "Contacto"    },
              ].map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-sm transition-all duration-300 hover:translate-x-1 inline-block"
                    style={{
                      color: "rgba(248,245,239,0.5)",
                      fontFamily: "var(--font-sans)",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.color = "var(--oa-white)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.color = "rgba(248,245,239,0.5)")
                    }
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Servicios */}
          <div>
            <h3
              className="label-tracking mb-5"
              style={{ color: "rgba(248,245,239,0.35)" }}
            >
              Servicios
            </h3>
            <ul className="space-y-3">
              {[
                "Inversión en pozo",
                "Desarrollos premium",
                "Renta temporaria",
                "Administración Airbnb",
                "Tasaciones",
              ].map((item) => (
                <li key={item}>
                  <span
                    className="text-sm"
                    style={{
                      color: "rgba(248,245,239,0.45)",
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto */}
          <div className="lg:col-span-2">
            <h3
              className="label-tracking mb-5"
              style={{ color: "rgba(248,245,239,0.35)" }}
            >
              Contacto
            </h3>
            <div className="space-y-3">
              <a
                href="mailto:info@barrerabrokers.com"
                className="block text-base md:text-lg transition-colors duration-300"
                style={{
                  color: "rgba(248,245,239,0.7)",
                  fontFamily: "var(--font-sans)",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = "var(--oa-white)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = "rgba(248,245,239,0.7)")
                }
              >
                info@barrerabrokers.com
              </a>
              <a
                href="tel:+541112345678"
                className="block text-sm transition-colors duration-300"
                style={{
                  color: "rgba(248,245,239,0.5)",
                  fontFamily: "var(--font-sans)",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = "var(--oa-white)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = "rgba(248,245,239,0.5)")
                }
              >
                +54 11 1234-5678
              </a>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "rgba(248,245,239,0.4)", fontFamily: "var(--font-sans)" }}
              >
                Av. Principal 123
                <br />
                Buenos Aires, Argentina
              </p>
            </div>
          </div>
        </div>

        {/* ── LÍNEA INFERIOR ── */}
        <div className="line-h mt-14 mb-6" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-3">
          <p
            className="text-[10px] uppercase tracking-[0.14em]"
            style={{ color: "rgba(248,245,239,0.2)", fontFamily: "var(--font-sans)" }}
          >
            &copy; {new Date().getFullYear()} Barrera Brokers
          </p>

          {/* Punto decorativo central */}
          <div
            className="w-1.5 h-1.5 rounded-full hidden md:block"
            style={{ background: "rgba(248,245,239,0.2)" }}
          />

          <p
            className="text-[10px] uppercase tracking-[0.14em]"
            style={{ color: "rgba(248,245,239,0.2)", fontFamily: "var(--font-sans)" }}
          >
            Buenos Aires · Argentina
          </p>
        </div>
      </div>
    </footer>
  );
}
