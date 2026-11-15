"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { ClipboardList, Mail, MailOpen, MessageCircle, Phone } from "lucide-react";

type Props = {
  leadId: string;
  emailId: string;
  name: string;
  recipient: string;
  subject: string;
  body?: string;
  sentAt: string;
  openedAt?: string;
  openCount: number;
  canCall: boolean;
  whatsappUrl: string;
  legacy?: boolean;
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function CrmEmailFollowup(props: Props) {
  const section = useRef<HTMLElement>(null);
  useEffect(() => { section.current?.scrollIntoView({ block: "start" }); }, [props.emailId]);
  const images = Array.from((props.body || "").matchAll(/\[\[BB_EMAIL_IMAGE:(https?:\/\/[^\]]+)\]\]/g), match => match[1]);
  const body = (props.body || "").replace(/\[\[BB_EMAIL_IMAGE:[^\]]+\]\]/g, "").trim();
  const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#006b6b]/25 bg-white px-4 text-sm font-semibold text-[#005c5c] hover:bg-[#e7f4f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006b6b]";
  return <section ref={section} id="email-followup" aria-labelledby="email-followup-title" className="mt-5 min-w-0 scroll-mt-32">
    <div className="rounded-xl border border-[#006b6b]/25 bg-white p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#e7f4f2] text-[#006b6b]"><MailOpen className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#006b6b]">{props.legacy ? "Última apertura registrada" : "Seguimiento de correo"}</p>
          <h2 id="email-followup-title" className="mt-1 break-words text-base font-semibold text-ink">{props.name}{props.openedAt ? " abrió tu correo" : " · Correo enviado"}</h2>
          <p className="mt-2 break-words text-base font-medium text-ink">{props.subject || "Sin asunto"}</p>
          <p className="mt-1 break-all text-sm text-ink/60">Para: {props.recipient}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Contactar y dar seguimiento al cliente">
        {props.canCall && <button type="button" onClick={() => window.dispatchEvent(new Event("crm:start-call"))} className={`${button} !border-[#006b6b] !bg-[#006b6b] !text-white hover:!bg-[#005656]`}><Phone className="h-4 w-4" />Llamar</button>}
        {props.whatsappUrl && <a href={props.whatsappUrl} target="_blank" rel="noopener noreferrer" className={button}><MessageCircle className="h-4 w-4" />WhatsApp</a>}
        <button type="button" onClick={() => window.dispatchEvent(new Event("crm:open-email-composer"))} className={button}><Mail className="h-4 w-4" />Enviar correo</button>
        <Link href={`/admin/crm/${props.leadId}?activity=tarea&email=${props.emailId}#activity-composer`} className={button}><ClipboardList className="h-4 w-4" />Crear seguimiento</Link>
      </div>
      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink/60">
        <div><dt className="inline font-semibold">Enviado: </dt><dd className="inline">{dateLabel(props.sentAt)}</dd></div>
        {props.openedAt && <div><dt className="inline font-semibold">Última apertura: </dt><dd className="inline">{dateLabel(props.openedAt)}</dd></div>}
        <div><dt className="inline font-semibold">Aperturas registradas: </dt><dd className="inline">{props.openCount}</dd></div>
      </dl>
      <details open className="mt-5 border-t border-ink/10 pt-4">
        <summary className="min-h-10 cursor-pointer text-sm font-semibold text-ink">Correo enviado</summary>
        {props.body ? <><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink/75">{body}</p>{images.length > 0 && <div className="mt-4 flex flex-wrap gap-3">{images.map((url, index) => <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer" aria-label={`Ampliar imagen del correo ${index + 1}`} className="inline-flex rounded-lg border border-ink/10 bg-[#f3f4f4] p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006b6b]"><Image src={url} alt={`Imagen del correo ${index + 1}`} width={160} height={120} className="h-24 w-32 rounded object-contain" /></a>)}</div>}</> : <p className="mt-3 text-sm text-ink/60">El contenido de este correo no está disponible en el historial. Podés identificarlo por el asunto, el destinatario y la fecha de envío.</p>}
      </details>
    </div>
  </section>;
}
