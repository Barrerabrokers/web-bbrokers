"use client";

import { FileText, Mail, MessageCircle } from "lucide-react";
import { openMailShare } from "@/lib/mail-share";

type ShareListingPdfProps = {
  title: string;
  pdfUrl: string;
  pageUrl: string;
  typeLabel: "propiedad" | "desarrollo";
  variant?: "light" | "dark";
};

export function ShareListingPdf({
  title,
  pdfUrl,
  pageUrl,
  typeLabel,
  variant = "light",
}: ShareListingPdfProps) {
  const pdfText = `Te comparto el link de la ficha PDF de este ${typeLabel}: ${title}\n\n${pdfUrl}`;
  const pageText = `Te comparto la ficha online de este ${typeLabel}: ${title}\n\n${pageUrl}`;
  const mailSubject = `Ficha PDF - ${title}`;
  const mailBody = `Hola,\n\nTe comparto la ficha PDF de este ${typeLabel}:\n${pdfUrl}\n\nTambién podés verlo online:\n${pageUrl}`;
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
          onClick={() => openMailShare(mailSubject, mailBody)}
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
    </div>
  );
}
