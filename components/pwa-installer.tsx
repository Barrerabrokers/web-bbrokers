"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Smartphone } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PwaInstaller({ compact = false }: { compact?: boolean }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  const isIos = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      const isLocalhost =
        window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

      if (isLocalhost) {
        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => {
            registrations.forEach((registration) => {
              void registration.unregister();
            });
          })
          .catch(() => undefined);
      } else {
        navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      }
    }

    setInstalled(isStandalone());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowIosHint(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice.catch(() => null);
      if (choice?.outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
      return;
    }

    if (isIos) setShowIosHint((current) => !current);
  };

  if (installed) return null;
  if (!installPrompt && !isIos) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleInstall}
        className={
          compact
            ? "btn-ghost text-xs"
            : "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-bone transition-colors hover:bg-ink-600"
        }
      >
        {isIos ? <Smartphone className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
        <span className={compact ? "hidden sm:inline" : ""}>Instalar app CRM</span>
      </button>

      {showIosHint && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-ink/12 bg-white p-4 text-sm leading-relaxed text-ink shadow-xl">
          En iPhone abrí el botón compartir de Safari y elegí{" "}
          <strong>Agregar a pantalla de inicio</strong>. Después entrás como app y usás el mismo login.
        </div>
      )}
    </div>
  );
}
