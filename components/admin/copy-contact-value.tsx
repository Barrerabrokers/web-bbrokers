"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

type CopyContactValueProps = {
  value: string;
  label: string;
};

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("No se pudo copiar el valor.");
}

export function CopyContactValue({ value, label }: CopyContactValueProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (status !== "copied") return;
    const timeout = window.setTimeout(() => setStatus("idle"), 1600);
    return () => window.clearTimeout(timeout);
  }, [status]);

  const copy = async () => {
    try {
      await copyToClipboard(value);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  };

  const copied = status === "copied";
  const error = status === "error";
  const action = copied ? `${label} copiado` : error ? `No se pudo copiar ${label.toLowerCase()}` : `Copiar ${label.toLowerCase()}`;

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 ${
        copied
          ? "text-emerald-600"
          : error
            ? "text-red-600"
            : "text-ink/45 hover:bg-accent/10 hover:text-accent"
      }`}
      aria-label={action}
      title={action}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      <span className="sr-only" aria-live="polite">{copied ? `${label} copiado.` : error ? `No se pudo copiar ${label.toLowerCase()}.` : ""}</span>
    </button>
  );
}
