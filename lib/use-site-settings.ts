"use client";

import { useEffect, useState } from "react";

export type ClientSiteSettings = {
  companyName:     string;
  email:           string;
  phone:           string;
  whatsapp:        string;
  addressStreet:   string;
  addressCity:     string;
  whatsappMessage: string;
};

export const DEFAULT_CLIENT_SETTINGS: ClientSiteSettings = {
  companyName:     "Barrera Brokers",
  email:           "info@barrerabrokers.com",
  phone:           "+54 11 1234-5678",
  whatsapp:        "541112345678",
  addressStreet:   "Av. Principal 123",
  addressCity:     "Buenos Aires, Argentina",
  whatsappMessage: "Hola! Me interesa conocer más sobre los desarrollos de Barrera Brokers.",
};

// Cache en memoria del módulo — compartido entre componentes que usen el hook,
// evita N requests cuando varios componentes lo consumen en la misma página.
let cachedSettings: ClientSiteSettings | null = null;
let inflight: Promise<ClientSiteSettings> | null = null;
const subscribers = new Set<(s: ClientSiteSettings) => void>();

async function fetchSettings(): Promise<ClientSiteSettings> {
  if (cachedSettings) return cachedSettings;
  if (inflight) return inflight;

  inflight = fetch("/api/settings", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
    .then((data: ClientSiteSettings) => {
      cachedSettings = { ...DEFAULT_CLIENT_SETTINGS, ...data };
      subscribers.forEach((fn) => fn(cachedSettings!));
      inflight = null;
      return cachedSettings!;
    })
    .catch(() => {
      inflight = null;
      return DEFAULT_CLIENT_SETTINGS;
    });

  return inflight;
}

/**
 * Hook para componentes client que necesiten los settings del sitio.
 * Devuelve los defaults instantáneamente y luego se actualiza con
 * los valores reales cuando llega la respuesta del API.
 */
export function useSiteSettings(): ClientSiteSettings {
  const [settings, setSettings] = useState<ClientSiteSettings>(
    cachedSettings ?? DEFAULT_CLIENT_SETTINGS
  );

  useEffect(() => {
    let cancelled = false;

    fetchSettings().then((s) => {
      if (!cancelled) setSettings(s);
    });

    // Subscriber para que si otro componente refresca el cache,
    // este también se actualice.
    const onUpdate = (s: ClientSiteSettings) => {
      if (!cancelled) setSettings(s);
    };
    subscribers.add(onUpdate);

    return () => {
      cancelled = true;
      subscribers.delete(onUpdate);
    };
  }, []);

  return settings;
}
