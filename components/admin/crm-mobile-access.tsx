"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Smartphone } from "lucide-react";

const PRODUCTION_CRM_URL = "https://barrerabrokers.com/admin/crm";

function crmUrlFromWindow() {
  if (typeof window === "undefined") return PRODUCTION_CRM_URL;

  const isLocalhost =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  if (isLocalhost) return PRODUCTION_CRM_URL;
  return `${window.location.origin}/admin/crm`;
}

export function CrmMobileAccess() {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const crmUrl = useMemo(() => crmUrlFromWindow(), []);

  useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(crmUrl, {
      margin: 1,
      width: 184,
      color: {
        dark: "#3a1d17",
        light: "#f8f5ef",
      },
    })
      .then((value) => {
        if (!cancelled) setQrDataUrl(value);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });

    return () => {
      cancelled = true;
    };
  }, [crmUrl]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(crmUrl).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="mb-4 hidden overflow-hidden rounded-xl border border-ink/12 bg-white text-ink shadow-sm lg:block">
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center md:p-5">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            <Smartphone className="h-4 w-4" />
            App CRM móvil
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">
            Abrí solo Contactos del CRM desde el celular.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/62">
            Escaneá el QR con el teléfono del agente. En iPhone se instala desde Safari con
            Compartir y “Agregar a pantalla de inicio”; en Android desde Chrome con “Instalar app”.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={crmUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#005c5c] px-4 text-sm font-medium text-white transition-colors hover:bg-[#004949]"
            >
              Abrir CRM
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-ink/15 bg-white px-4 text-sm font-medium text-ink transition-colors hover:bg-cream-100"
            >
              {copied ? <Check className="h-4 w-4 text-[#005c5c]" /> : <Copy className="h-4 w-4" />}
              {copied ? "Link copiado" : "Copiar link"}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-lg border border-ink/10 bg-cream-50 p-3">
          <div className="flex h-36 w-36 items-center justify-center rounded-md bg-white p-2">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="QR para abrir Barrera Brokers CRM en el celular" className="h-full w-full" />
            ) : (
              <div className="h-full w-full animate-pulse rounded bg-ink/5" />
            )}
          </div>
          <div className="hidden max-w-[150px] text-xs leading-relaxed text-ink/55 lg:block">
            El QR usa el dominio público para que funcione desde cualquier celular.
          </div>
        </div>
      </div>
    </section>
  );
}
