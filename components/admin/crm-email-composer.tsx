"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Mail, Search, X } from "lucide-react";
import type { CrmEmailTemplate, CrmEmailTemplateContentBlock } from "@/lib/db";
import { CrmRichEmailEditor } from "@/components/admin/crm-rich-email-editor";

type EmailHistoryItem = { id: string; title: string; body: string; createdAt: string; openCount?: number };

const EMAIL_IMAGE_MARKER = /\[\[BB_EMAIL_IMAGE:(https?:\/\/[^\]]+)\]\]/g;
const LEGACY_IMAGE_LINE = /^(?:Imagen:\s*)?(https?:\/\/\S+\.(?:avif|gif|jpe?g|png|webp)(?:\?\S*)?)$/i;

function emailHistoryContent(body: string) {
  const images = Array.from(body.matchAll(EMAIL_IMAGE_MARKER), (match) => match[1]);
  const textLines: string[] = [];
  for (const line of body.replace(EMAIL_IMAGE_MARKER, "").split("\n")) {
    const legacyImage = line.trim().match(LEGACY_IMAGE_LINE);
    if (legacyImage) images.push(legacyImage[1]);
    else textLines.push(line);
  }
  return { text: textLines.join("\n").trim(), images: Array.from(new Set(images)) };
}

type LeadForEmail = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode: string;
  developmentName?: string;
  developmentNameText?: string;
  assignedAgentName?: string;
};

export function CrmEmailComposer({ lead, templates, history = [] }: { lead: LeadForEmail; templates: CrmEmailTemplate[]; history?: EmailHistoryItem[] }) {
  const router = useRouter();
  const emailTemplates = useMemo(() => templates.filter((template) => template.channel === "email"), [templates]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [subject, setSubject] = useState("Barrera Brokers");
  const [body, setBody] = useState(`Hola ${lead.firstName},\n\n`);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [contentBlocks, setContentBlocks] = useState<CrmEmailTemplateContentBlock[]>([{ id: "crm-draft-text", type: "text", text: `Hola ${lead.firstName},\n\n`, html: `Hola ${lead.firstName},<br><br>`, color: "#1c1a17", fontFamily: "Arial, Helvetica, sans-serif", fontSize: 16, align: "left" }]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const openComposer = () => setOpen(true);
    window.addEventListener("crm:open-email-composer", openComposer);
    return () => window.removeEventListener("crm:open-email-composer", openComposer);
  }, []);

  const variables: Record<string, string> = {
    "{{cliente_nombre}}": lead.firstName,
    "{{cliente_apellido}}": lead.lastName,
    "{{cliente_nombre_completo}}": `${lead.firstName} ${lead.lastName}`.trim(),
    "{{cliente_email}}": lead.email,
    "{{cliente_telefono}}": `${lead.countryCode}${lead.phone}`,
    "{{desarrollo}}": lead.developmentName || lead.developmentNameText || "el desarrollo que consultaste",
    "{{propietario_contacto}}": lead.assignedAgentName || "Barrera Brokers",
  };
  const applyVariables = (value: string) => Object.entries(variables).reduce((text, [token, replacement]) => text.replaceAll(token, replacement), value || "");
  const visibleTemplates = emailTemplates.filter((template) => `${template.name} ${template.category} ${template.subject}`.toLocaleLowerCase("es-AR").includes(query.trim().toLocaleLowerCase("es-AR")));

  const chooseTemplate = (template: CrmEmailTemplate) => {
    const blocks = template.contentBlocks.map((block) => block.type === "text"
      ? { ...block, text: applyVariables(block.text), html: block.html ? applyVariables(block.html) : block.html }
      : block.type === "button" ? { ...block, label: applyVariables(block.label), url: applyVariables(block.url) }
        : block.type === "columns" ? { ...block, columns: block.columns.map((column) => column.type === "text" ? { ...column, text: applyVariables(column.text), html: column.html ? applyVariables(column.html) : column.html } : column) }
          : block);
    const effectiveBlocks = blocks.length ? blocks : [
      { id: "legacy-text", type: "text" as const, text: applyVariables(template.body) },
      ...template.imageUrls.map((url, index) => ({ id: `legacy-image-${index}`, type: "image" as const, url, width: 100 })),
    ];
    const plainText = effectiveBlocks.map((block) => block.type === "text" ? block.text : block.type === "button" ? `${block.label}: ${block.url}` : block.type === "attachment" ? `${block.name}: ${block.url}` : block.type === "columns" ? block.columns.filter((column) => column.type === "text").map((column) => column.text).join("\n") : "").filter(Boolean).join("\n\n");
    setSelectedTemplateId(template.id);
    setSubject(applyVariables(template.subject));
    setBody(plainText || applyVariables(template.body));
    setImageUrls(effectiveBlocks.flatMap((block) => block.type === "image" ? [block.url] : block.type === "columns" ? block.columns.filter((column) => column.type === "image").map((column) => column.url) : []));
    setContentBlocks(effectiveBlocks);
    setNotice(`Plantilla aplicada: ${template.name}`);
    setError("");
  };

  const updateBlocks = (next: CrmEmailTemplateContentBlock[]) => {
    setContentBlocks(next);
    setBody(next.flatMap((block) => block.type === "text" ? [block.text] : block.type === "columns" ? block.columns.flatMap((column) => column.type === "text" ? [column.text] : []) : []).filter(Boolean).join("\n\n"));
    setImageUrls(next.flatMap((block) => block.type === "image" ? [block.url] : block.type === "columns" ? block.columns.flatMap((column) => column.type === "image" ? [column.url] : []) : []));
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/crm/email/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: lead.id, subject, body, imageUrls, contentBlocks }) });
      const data = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "No se pudo enviar el correo.");
      setNotice("Correo enviado y registrado en las actividades.");
      router.refresh();
      window.setTimeout(() => setOpen(false), 1200);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo enviar el correo."); }
    finally { setSending(false); }
  };

  return <>
    <section id="correo-crm" className="rounded-xl bg-white p-5 ring-1 ring-ink/10">
      <div className="flex items-center justify-between gap-3 border-b border-ink/10 pb-4"><span className="flex items-center gap-3 text-[#006b6b]"><Mail className="h-5 w-5" /><h2 className="text-base font-semibold text-ink">Correos enviados</h2></span><span className="text-xs font-medium text-ink/50">{history.length}</span></div>
      {history.length ? <ol className="divide-y divide-ink/8">{history.slice(0, 3).map((item) => {
        const content = emailHistoryContent(item.body || "");
        return <li key={item.id} className="py-3"><div className="flex items-start justify-between gap-3"><p className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{item.title.replace(/^Correo enviado:\s*/i, "")}</p>{typeof item.openCount === "number" && <span className="shrink-0 rounded-full bg-[#e7f4f2] px-2 py-1 text-[10px] font-semibold text-[#006b6b]">{item.openCount} {item.openCount === 1 ? "apertura" : "aperturas"}</span>}</div>{content.images.length > 0 && <div className="mt-2 space-y-2">{content.images.map((url) => <div key={url} className="overflow-hidden rounded-lg bg-[#f3f4f4]"><img src={url} alt="Imagen enviada en el correo" className="block h-auto max-h-48 w-full object-contain" loading="lazy" /></div>)}</div>}{content.text && <p className="mt-2 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-ink/60">{content.text}</p>}<time className="mt-1.5 block text-[11px] font-medium text-ink/45">{new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAt))}</time></li>;
      })}</ol> : <p className="mt-4 text-sm leading-relaxed text-ink/60">Todavía no se enviaron correos a este contacto.</p>}
      <button type="button" onClick={() => setOpen(true)} className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border border-[#006b6b] px-4 text-sm font-medium text-[#006b6b] transition-colors hover:bg-[#e7f4f2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b] focus-visible:ring-offset-2">Redactar correo</button>
    </section>

    {open && <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="crm-email-title" className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-xl bg-white sm:rounded-xl">
        <header className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-4 sm:px-6">
          <div><h2 id="crm-email-title" className="text-lg font-semibold text-ink">Enviar correo desde el CRM</h2><p className="mt-1 text-sm text-ink/60">Para: <span className="font-medium text-ink">{lead.firstName} {lead.lastName}</span> · {lead.email}</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar compositor" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink/60 hover:bg-[#e7f4f2] hover:text-ink"><X className="h-5 w-5" /></button>
        </header>
        <form onSubmit={send} className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="min-h-0 border-b border-ink/10 bg-[#f3f4f4] p-4 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-ink">Plantillas de correo</h3><span className="text-xs text-ink/55">{emailTemplates.length}</span></div>
            <div className="relative mt-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar plantillas" className="h-10 w-full rounded-lg border border-ink/15 bg-white pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink/50 focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15" /></div>
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1 lg:max-h-[58vh]">
              {visibleTemplates.map((template) => <button key={template.id} type="button" onClick={() => chooseTemplate(template)} className={`w-full rounded-lg p-3 text-left transition-colors ${selectedTemplateId === template.id ? "bg-[#006b6b] text-white" : "bg-white text-ink ring-1 ring-ink/10 hover:bg-[#e7f4f2]"}`}><span className="block text-sm font-semibold">{template.name}</span><span className={`mt-1 block text-xs ${selectedTemplateId === template.id ? "text-white/75" : "text-ink/55"}`}>{template.category} · {template.subject || "Sin asunto"}</span></button>)}
              {visibleTemplates.length === 0 && <p className="rounded-lg border border-dashed border-ink/15 px-3 py-6 text-center text-sm text-ink/55">No hay plantillas que coincidan.</p>}
            </div>
          </aside>
          <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
            <label className="block text-sm font-semibold text-ink">Asunto<input required value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-ink/15 px-3 text-sm font-normal text-ink outline-none focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15" /></label>
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-ink">Mensaje</h3><span className="text-xs text-ink/50">Vista final · 640 px</span></div>
              <CrmRichEmailEditor blocks={contentBlocks} onChange={updateBlocks} onNotice={setNotice} />
            </div>
            {notice && <p className="mt-3 flex items-center gap-2 text-sm font-medium text-[#006b6b]"><CheckCircle2 className="h-4 w-4" />{notice}</p>}
            {error && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{error}</p>}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-lg border border-ink/15 px-5 text-sm font-medium text-ink hover:bg-[#f3f4f4]">Cancelar</button><button disabled={sending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#006b6b] px-5 text-sm font-semibold text-white hover:bg-[#004949] disabled:cursor-wait disabled:opacity-60">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}{sending ? "Enviando…" : "Enviar correo"}</button></div>
          </div>
        </form>
      </section>
    </div>}
  </>;
}
