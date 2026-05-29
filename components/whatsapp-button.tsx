"use client";

/**
 * WhatsAppButton — botón flotante siempre visible.
 * Lee el número y mensaje desde site_settings (editable en /admin/settings).
 * Usa defaults si la DB aún no respondió.
 */

import { useSiteSettings } from "@/lib/use-site-settings";

export function WhatsAppButton() {
  const { whatsapp, whatsappMessage } = useSiteSettings();

  // Sanitiza por si vino con formato (igual el server lo limpia, pero defensivo)
  const phone = whatsapp.replace(/[^\d]/g, "");
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      className="group fixed bottom-6 right-6 z-[60] flex items-center justify-center rounded-full transition-all duration-500"
      style={{
        width: "58px",
        height: "58px",
        background: "#25D366",
        boxShadow: "0 8px 28px rgba(37,211,102,0.45), 0 4px 12px rgba(0,0,0,0.18)",
        transitionTimingFunction: "var(--ease-out-expo, cubic-bezier(0.19,1,0.22,1))",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "scale(1.08)";
        el.style.boxShadow = "0 12px 36px rgba(37,211,102,0.55), 0 4px 12px rgba(0,0,0,0.2)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "scale(1)";
        el.style.boxShadow = "0 8px 28px rgba(37,211,102,0.45), 0 4px 12px rgba(0,0,0,0.18)";
      }}
    >
      {/* Anillo pulse sutil */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: "#25D366",
          animation: "wa-pulse 2.5s ease-out infinite",
          opacity: 0.5,
        }}
      />

      {/* Icono WhatsApp */}
      <svg
        viewBox="0 0 32 32"
        width="28"
        height="28"
        fill="white"
        className="relative z-10"
        aria-hidden="true"
      >
        <path d="M16.003 3.2C9.93 3.2 5 8.13 5 14.2c0 2.193.65 4.243 1.764 5.97L5 27.2l7.243-1.736a10.964 10.964 0 0 0 3.76.66c6.073 0 11-4.93 11-11s-4.927-10.924-11-10.924zm0 20.014c-1.182 0-2.34-.318-3.357-.918l-.24-.143-3.74.896.997-3.65-.157-.25a8.92 8.92 0 0 1-1.36-4.748c0-4.93 4.013-8.94 8.957-8.94s8.96 4.012 8.96 8.94c0 4.94-4.014 8.813-8.96 8.813zm4.91-6.687c-.27-.135-1.594-.787-1.84-.877-.247-.09-.427-.135-.607.135-.18.27-.697.876-.854 1.057-.157.18-.314.203-.584.067-.27-.135-1.137-.418-2.165-1.334-.8-.713-1.34-1.594-1.498-1.864-.157-.27-.017-.416.118-.55.12-.122.27-.314.405-.471.135-.157.18-.27.27-.45.09-.18.045-.337-.022-.473-.067-.135-.607-1.464-.832-2.005-.22-.527-.444-.456-.607-.464l-.517-.01a1.005 1.005 0 0 0-.722.337c-.247.27-.945.923-.945 2.252 0 1.328.967 2.61 1.102 2.79.135.18 1.9 2.9 4.6 4.07.643.277 1.144.443 1.535.567.645.205 1.232.176 1.696.107.518-.077 1.594-.65 1.82-1.28.225-.63.225-1.17.157-1.28-.067-.113-.247-.18-.517-.315z"/>
      </svg>

      <style jsx>{`
        @keyframes wa-pulse {
          0%   { transform: scale(1);   opacity: 0.5; }
          70%  { transform: scale(1.5); opacity: 0;   }
          100% { transform: scale(1.5); opacity: 0;   }
        }
      `}</style>
    </a>
  );
}
