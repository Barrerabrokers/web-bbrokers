import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Barrera Brokers CRM",
    short_name: "BB CRM",
    description:
      "CRM de Barrera Brokers para gestionar contactos, llamadas, reuniones, tareas, plantillas y seguimiento comercial.",
    start_url: "/admin/crm",
    scope: "/",
    display: "standalone",
    background_color: "#efe6d8",
    theme_color: "#3a1d17",
    orientation: "any",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/crm-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/crm-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/crm-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Contactos",
        short_name: "Contactos",
        description: "Abrir el listado de contactos del CRM",
        url: "/admin/crm",
        icons: [{ src: "/crm-icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Plantillas",
        short_name: "Plantillas",
        description: "Abrir plantillas de correo y WhatsApp",
        url: "/admin/crm/plantillas",
        icons: [{ src: "/crm-icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Cotizaciones",
        short_name: "Cotizaciones",
        description: "Crear y enviar cotizaciones",
        url: "/admin/cotizaciones",
        icons: [{ src: "/crm-icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
