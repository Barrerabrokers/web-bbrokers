import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de privacidad | Barrera Brokers",
  description:
    "Cómo Barrera Brokers recopila, utiliza y protege los datos personales de clientes y potenciales clientes.",
  alternates: {
    canonical: "https://barrerabrokers.com/politica-de-privacidad",
  },
};

const sections = [
  {
    title: "Información que recopilamos",
    body: "Podemos recibir nombre, apellido, correo electrónico, teléfono, país, preferencias de contacto y la información que una persona complete voluntariamente en formularios del sitio, campañas publicitarias de Meta, WhatsApp u otros canales de consulta.",
  },
  {
    title: "Cómo usamos la información",
    body: "Usamos estos datos para responder consultas, identificar el desarrollo o propiedad de interés, brindar información comercial, coordinar reuniones, mantener el historial de atención en nuestro CRM y mejorar el seguimiento de cada solicitud.",
  },
  {
    title: "Meta Lead Ads",
    body: "Cuando una persona completa un formulario instantáneo de Facebook o Instagram, Meta nos transmite los datos que esa persona decidió enviar. La integración los incorpora al CRM de Barrera Brokers para que un asesor pueda atender la consulta. No utilizamos esta conexión para publicar en nombre de la persona.",
  },
  {
    title: "Conservación y seguridad",
    body: "Conservamos la información durante el tiempo necesario para gestionar la relación comercial y cumplir obligaciones aplicables. Aplicamos controles de acceso por rol: cada agente accede únicamente a los contactos asignados y los administradores autorizados pueden supervisar el conjunto de contactos.",
  },
  {
    title: "Proveedores y transferencias",
    body: "Podemos utilizar proveedores tecnológicos para operar el CRM, alojar el sitio, enviar comunicaciones y recibir formularios. Solo compartimos la información necesaria para prestar esos servicios o cuando existe una obligación legal.",
  },
  {
    title: "Tus derechos",
    body: "Podés solicitar acceso, actualización, corrección o eliminación de tus datos y dejar de recibir comunicaciones comerciales. Para hacerlo, escribinos indicando tu nombre y el dato de contacto utilizado en la consulta.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[var(--oa-bg-cream)] text-[var(--oa-black)]">
      <header className="border-b border-black/10">
        <div className="container-custom flex min-h-20 items-center justify-between gap-6">
          <Link href="/" className="text-sm font-medium tracking-[-0.01em]">
            Barrera Brokers
          </Link>
          <Link href="/" className="text-sm text-black/70 transition-colors hover:text-black">
            Volver al sitio
          </Link>
        </div>
      </header>

      <article className="container-custom py-14 sm:py-20 lg:py-28">
        <div className="max-w-3xl">
          <p className="mb-5 text-sm text-black/65">Última actualización: 2 de septiembre de 2026</p>
          <h1 className="heading-serif max-w-2xl text-5xl sm:text-6xl lg:text-7xl">
            Política de privacidad
          </h1>
          <p className="mt-8 max-w-[68ch] text-base leading-7 text-black/75 sm:text-lg sm:leading-8">
            Barrera Brokers protege la información personal de quienes consultan por propiedades,
            desarrollos e inversiones inmobiliarias. Esta política explica qué datos tratamos y con
            qué finalidad.
          </p>
        </div>

        <div className="mt-14 max-w-3xl border-t border-black/15 sm:mt-20">
          {sections.map((section) => (
            <section
              key={section.title}
              className="grid gap-3 border-b border-black/15 py-8 sm:grid-cols-[13rem_1fr] sm:gap-10 sm:py-10"
            >
              <h2 className="text-base font-medium leading-6">{section.title}</h2>
              <p className="max-w-[68ch] text-base leading-7 text-black/75">{section.body}</p>
            </section>
          ))}
        </div>

        <section className="mt-12 max-w-3xl bg-[var(--oa-black)] px-6 py-8 text-[var(--oa-white)] sm:px-9 sm:py-10">
          <h2 className="text-xl font-medium">Contacto</h2>
          <p className="mt-3 max-w-[65ch] text-base leading-7 text-white/75">
            Para consultas sobre privacidad o para ejercer tus derechos, escribí a{" "}
            <a
              href="mailto:pablo@barrerabrokers.com"
              className="font-medium text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
            >
              pablo@barrerabrokers.com
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
