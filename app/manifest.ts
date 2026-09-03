import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Barrera Brokers CRM",
    short_name: "BB CRM",
    description:
      "CRM móvil de Barrera Brokers para consultar y gestionar contactos.",
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
    ],
  };
}
