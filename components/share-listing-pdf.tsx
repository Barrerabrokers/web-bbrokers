"use client";

import { useState } from "react";
import { Copy, Check, FileText, Mail, MessageCircle } from "lucide-react";
import { openMailShare } from "@/lib/mail-share";

type ShareListingPdfProps = {
  title: string;
  pdfUrl: string;
  pageUrl: string;
  coverUrl?: string;
  mailComposerUrl?: string;
  typeLabel: "propiedad" | "desarrollo";
  variant?: "light" | "dark";
};

export function ShareListingPdf({
  title,
  pdfUrl,
  pageUrl,
  coverUrl,
  mailComposerUrl,
  typeLabel,
  variant = "light",
}: ShareListingPdfProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  async function copyLink() {
    try { await navigator.clipboard.writeText(pageUrl); setCopied(true); setCopyError(""); }
    catch { setCopyError("No se pudo copiar. Podés usar WhatsApp link para compartir la ficha."); }
  }
  const pageText = `Te comparto la ficha online de ${typeLabel === "propiedad" ? "esta propiedad" : "este desarrollo"}: ${title}\n\n${pageUrl}`;
  // Put the HTML listing first so WhatsApp can read its cover image metadata.
  const pdfText = `${pageText}\n\nFicha PDF: ${pdfUrl}`;
  const mailSubject = `Ficha PDF - ${title}`;
  const mailBody = `Hola,\n\nTe comparto la ficha PDF de este ${typeLabel}:\n${pdfUrl}\n\nTambién podés verlo online:\n${pageUrl}`;
  function shareMail() {
    if (mailComposerUrl) { window.location.assign(mailComposerUrl); return; }
    void openMailShare(mailSubject, mailBody);
  }
  const whatsappPdfUrl = `https://wa.me/?text=${encodeURIComponent(pdfText)}`;
  const whatsappPageUrl = `https://wa.me/?text=${encodeURIComponent(pageText)}`;

  const baseButton =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors";
  const outline =
    variant === "dark"
      ? "border border-bone/25 text-bone hover:border-bone hover:bg-bone/10"
      : "border border-ink/20 text-ink hover:border-ink hover:bg-ink/5";
  const solid =
    variant === "dark"
      ? "bg-bone text-ink hover:bg-cream-200"
      : "bg-ink text-bone hover:bg-ink-600";

  return (
    <div className="space-y-3">
      <p
        className={`text-[10px] font-medium uppercase tracking-[0.16em] ${
          variant === "dark" ? "text-bone/55" : "text-ink/55"
        }`}
      >
        Enviar ficha
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        <button type="button" onClick={() => void copyLink()} className={`${baseButton} ${outline}`}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Link copiado" : "Copiar link"}
        </button>
        <a href={whatsappPdfUrl} target="_blank" rel="noopener noreferrer" className={`${baseButton} ${solid}`}>
          <MessageCircle className="h-4 w-4" />
          WhatsApp PDF
        </a>
        <a href={whatsappPageUrl} target="_blank" rel="noopener noreferrer" className={`${baseButton} ${outline}`}>
          <MessageCircle className="h-4 w-4" />
          WhatsApp link
        </a>
        <button
          type="button"
          onClick={shareMail}
          className={`${baseButton} ${outline}`}
        >
          <Mail className="h-4 w-4" />
          Mail
        </button>
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className={`${baseButton} ${outline}`}>
          <FileText className="h-4 w-4" />
          Ver PDF
        </a>
      </div>
      {copied && <p role="status" className="text-xs">Link listo para enviar al cliente.</p>}
      {copyError && <p role="alert" className="text-xs text-red-600">{copyError}</p>}
    </div>
  );
}
