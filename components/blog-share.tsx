import { Mail, MessageCircle } from "lucide-react";
import { buildMailto } from "@/lib/mail-share";

type BlogShareProps = { title: string; url: string };

/** Native share links keep the reader in control of the recipient and send. */
export function BlogShare({ title, url }: BlogShareProps) {
  const message = `Te comparto este artículo de Barrera Brokers:\n\n${title}\n\n${url}`;
  return (
    <nav className="journal-share" aria-label="Compartir artículo">
      <span className="journal-share-label">Compartir esta nota</span>
      <div className="journal-share-actions">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="journal-share-button"
          aria-label="Compartir artículo por WhatsApp"
        >
          <MessageCircle size={17} aria-hidden="true" />WhatsApp
        </a>
        <a
          href={buildMailto(`${title} | Barrera Brokers`, message)}
          className="journal-share-button"
          aria-label="Compartir artículo por correo electrónico"
        >
          <Mail size={17} aria-hidden="true" />Enviar por mail
        </a>
      </div>
    </nav>
  );
}
