"use client";

import type {
  ChangeEvent,
  DragEvent,
  FormEvent,
  PointerEvent,
  ReactNode,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CheckCircle2,
  BadgePercent,
  Columns2,
  Copy,
  FileText,
  GripVertical,
  Image as ImageIcon,
  FileImage,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Mail,
  Monitor,
  MessageCircle,
  Minus,
  Palette,
  Pencil,
  Plus,
  Search,
  Smartphone,
  Trash2,
  Type,
  Underline,
  Undo2,
  Redo2,
  Wand2,
} from "lucide-react";
import type { CrmEmailTemplate, CrmEmailTemplateContentBlock } from "@/lib/db";

type TemplateContentBlock = CrmEmailTemplateContentBlock;

type TemplateForm = {
  id: string;
  channel: "email" | "whatsapp";
  name: string;
  category: string;
  subject: string;
  body: string;
  imageUrls: string[];
  contentBlocks: TemplateContentBlock[];
};

const DEFAULT_BODY =
  "Hola {{cliente_nombre}},\n\nTe comparto información sobre {{desarrollo}}.\n\nQuedo atento para avanzar con disponibilidad, valores y forma de pago.\n\nSaludos,\n{{propietario_contacto}}";
const DEFAULT_WHATSAPP_BODY =
  "Hola {{cliente_nombre}}, soy {{propietario_contacto}}\n\nTe escribo por una consulta que nos dejaste sobre nuestro Desarrollo {{desarrollo}}.";

const VARIABLES = [
  { token: "{{cliente_nombre}}", label: "Nombre del cliente" },
  { token: "{{cliente_email}}", label: "Mail del cliente" },
  { token: "{{cliente_telefono}}", label: "Teléfono" },
  { token: "{{desarrollo}}", label: "Desarrollo" },
  { token: "{{propietario_contacto}}", label: "Propietario" },
] as const;

const EMAIL_FONTS = [
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Trebuchet", value: "'Trebuchet MS', Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times", value: "'Times New Roman', Times, serif" },
  { label: "Garamond", value: "Garamond, Georgia, serif" },
  { label: "Courier", value: "'Courier New', Courier, monospace" },
  { label: "Inter", value: "Inter, Arial, sans-serif" },
] as const;

const TEXT_COLORS = [
  "#000000", "#ff1717", "#ff920d", "#ffeb0a", "#16d940", "#12d9df", "#172bd8", "#8429df", "#e826df",
  "#ffffff", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#c9daf8", "#d9d2e9", "#ead1dc",
  "#eeeeee", "#ea9999", "#f9cb9c", "#ffe599", "#b6d7a8", "#a2c4c9", "#9fc5e8", "#b4a7d6", "#d5a6bd",
  "#cccccc", "#e06666", "#f6b26b", "#ffd966", "#93c47d", "#76a5af", "#6fa8dc", "#8e7cc3", "#c27ba0",
  "#999999", "#cc0000", "#e69138", "#f1c232", "#6aa84f", "#45818e", "#3d85c6", "#674ea7", "#a64d79",
  "#666666", "#990000", "#b45f06", "#bf9000", "#38761d", "#134f5c", "#0b5394", "#351c75", "#741b47",
  "#434343", "#660000", "#783f04", "#7f6000", "#274e13", "#0c343d", "#073763", "#20124d", "#4c1130",
] as const;

function TextColorPalette({ disabled = false, compact = false, onPick }: { disabled?: boolean; compact?: boolean; onPick: (color: string) => void }) {
  return (
    <details className="group relative">
      <summary className={`flex cursor-pointer list-none items-center justify-center rounded-lg border border-ink/12 bg-white text-ink/70 transition-colors hover:bg-cream-100 group-open:border-[#005c5c] group-open:text-[#005c5c] ${compact ? "h-8 w-8" : "min-h-9 gap-2 px-3 text-xs font-semibold"} ${disabled ? "pointer-events-none opacity-40" : ""}`} aria-label="Abrir paleta de colores de texto">
        <Palette className="h-4 w-4" />
        {!compact && <span>Color</span>}
      </summary>
      <div className={`absolute z-50 mt-2 rounded-xl border border-ink/12 bg-white p-3 shadow-[0_18px_45px_rgba(21,20,21,0.18)] ${compact ? "left-0" : "right-0"}`}>
        <p className="mb-2 text-xs font-semibold text-ink">Color del texto</p>
        <div className="grid grid-cols-9 gap-1.5" aria-label="Paleta de colores de texto">
          {TEXT_COLORS.map((color) => <button key={color} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onPick(color)} className="h-6 w-6 rounded border border-black/15 transition-transform hover:z-10 hover:scale-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#005c5c] focus-visible:ring-offset-1" style={{ backgroundColor: color }} aria-label={`Aplicar color ${color}`} title={color} />)}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink/10 pt-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink/70"><span>Personalizado</span><input type="color" defaultValue="#005c5c" onChange={(event) => onPick(event.target.value)} className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0" aria-label="Elegir color personalizado" /></label>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onPick("#1c1a17")} className="text-xs font-semibold text-[#005c5c] hover:underline">Restablecer</button>
        </div>
      </div>
    </details>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function textToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim())
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

function stripHtml(value: string) {
  if (typeof window !== "undefined") {
    const element = window.document.createElement("div");
    element.innerHTML = value;
    return element.textContent?.trim() || "";
  }
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function variablePreview(value: string) {
  return value
    .replaceAll("{{cliente_nombre}}", "Federico")
    .replaceAll("{{cliente_email}}", "cliente@email.com")
    .replaceAll("{{cliente_telefono}}", "+54 11 5555-5555")
    .replaceAll("{{desarrollo}}", "Alpha Place Belgrano")
    .replaceAll("{{propietario_contacto}}", "Pablo Barrera");
}

function newTextBlock(text = ""): Extract<TemplateContentBlock, { type: "text" }> {
  return {
    id: crypto.randomUUID(),
    type: "text",
    text,
    html: textToHtml(text),
    color: "#1c1a17",
    fontFamily: EMAIL_FONTS[0].value,
    fontSize: 16,
    align: "left",
    backgroundColor: "#ffffff",
    padding: 0,
  };
}

function newTitleBlock(): Extract<TemplateContentBlock, { type: "text" }> {
  return {
    ...newTextBlock("Título del correo"),
    html: "<h1>Título del correo</h1>",
    fontFamily: EMAIL_FONTS[0].value,
    fontSize: 34,
    align: "left",
  };
}

function newButtonBlock(): Extract<TemplateContentBlock, { type: "button" }> {
  return {
    id: crypto.randomUUID(),
    type: "button",
    label: "Ver propuesta",
    url: "https://barrerabrokers.com",
    align: "center",
    backgroundColor: "#005c5c",
    textColor: "#ffffff",
    borderRadius: 999,
  };
}

function newDividerBlock(): Extract<TemplateContentBlock, { type: "divider" }> {
  return {
    id: crypto.randomUUID(),
    type: "divider",
    color: "#d8d1c6",
    thickness: 1,
    width: 100,
  };
}

function newSpacerBlock(): Extract<TemplateContentBlock, { type: "spacer" }> {
  return {
    id: crypto.randomUUID(),
    type: "spacer",
    height: 28,
  };
}

function newColumnsBlock(widths = [50, 50]): Extract<TemplateContentBlock, { type: "columns" }> {
  return {
    id: crypto.randomUUID(),
    type: "columns",
    gap: 20,
    widths,
    columns: widths.map((_, index) => ({
      type: "text" as const,
      text: `Texto de la columna ${index + 1}`,
      html: `<p>Texto de la columna ${index + 1}</p>`,
      color: "#1c1a17",
      fontSize: 16,
      fontFamily: EMAIL_FONTS[0].value,
      align: "left" as const,
      bold: false,
    })),
  };
}

function newEmptyTemplate(channel: "email" | "whatsapp" = "email"): TemplateForm {
  const body = channel === "whatsapp" ? DEFAULT_WHATSAPP_BODY : DEFAULT_BODY;
  const textBlock = newTextBlock(body);
  return {
    id: "",
    channel,
    name: "",
    category: channel === "whatsapp" ? "WhatsApp" : "Seguimiento",
    subject: channel === "whatsapp" ? "Mensaje de WhatsApp" : "Información de {{desarrollo}}",
    body,
    imageUrls: [],
    contentBlocks: [textBlock],
  };
}

function normalizeBlock(block: TemplateContentBlock): TemplateContentBlock {
  if (block.type === "text") {
    return {
      ...block,
      html: block.html || textToHtml(block.text || ""),
      color: block.color || "#1c1a17",
      fontFamily: block.fontFamily || EMAIL_FONTS[0].value,
      fontSize: block.fontSize || 16,
      align: block.align || "left",
      backgroundColor: block.backgroundColor || "#ffffff",
      padding: block.padding || 0,
    };
  }
  if (block.type === "image") {
    return {
      ...block,
      width: block.width || 100,
      align: block.align || "center",
      alt: block.alt || "",
      borderRadius: block.borderRadius ?? 12,
      caption: block.caption || "",
      linkUrl: block.linkUrl || "",
    };
  }
  if (block.type === "button") {
    return {
      ...block,
      label: block.label || "Ver propuesta",
      url: block.url || "https://barrerabrokers.com",
      align: block.align || "center",
      backgroundColor: block.backgroundColor || "#005c5c",
      textColor: block.textColor || "#ffffff",
      borderRadius: block.borderRadius ?? 999,
    };
  }
  if (block.type === "divider") {
    return {
      ...block,
      color: block.color || "#d8d1c6",
      thickness: block.thickness || 1,
      width: block.width || 100,
    };
  }
  if (block.type === "spacer") {
    return {
      ...block,
      height: block.height || 28,
    };
  }
  if (block.type === "columns") {
    return {
      ...block,
      gap: block.gap ?? 20,
      widths: block.widths?.length === block.columns.length ? block.widths : block.columns.map(() => 100 / block.columns.length),
      columns: block.columns.slice(0, 4).map((column) => column.type === "text"
        ? { ...column, html: column.html || textToHtml(column.text), color: column.color || "#1c1a17", fontSize: column.fontSize || 16, fontFamily: column.fontFamily || EMAIL_FONTS[0].value, align: column.align || "left", bold: column.bold || false }
        : { ...column, alt: column.alt || "", borderRadius: column.borderRadius ?? 8 }),
    };
  }
  return block;
}

function contentBlocksFromTemplate(template: CrmEmailTemplate): TemplateContentBlock[] {
  if (template.contentBlocks?.length) return template.contentBlocks.map(normalizeBlock);

  const blocks: TemplateContentBlock[] = [];
  if (template.body.trim()) blocks.push(newTextBlock(template.body));
  template.imageUrls.forEach((url) => {
    blocks.push({ id: crypto.randomUUID(), type: "image", url, width: 100, align: "center" });
  });
  return blocks.length ? blocks : [newTextBlock("")];
}

function textFromBlocks(blocks: TemplateContentBlock[]) {
  return blocks
    .flatMap((block) => block.type === "text"
      ? [block.text || stripHtml(block.html || "")]
      : block.type === "columns"
        ? block.columns.filter((column) => column.type === "text").map((column) => column.text || stripHtml(column.html || ""))
        : [])
    .join("\n\n")
    .trim();
}

function imageUrlsFromBlocks(blocks: TemplateContentBlock[]) {
  return blocks.flatMap((block) => block.type === "image"
    ? [block.url]
    : block.type === "columns"
      ? block.columns.filter((column) => column.type === "image").map((column) => column.url)
      : []);
}

function templateToForm(template: CrmEmailTemplate): TemplateForm {
  const contentBlocks = contentBlocksFromTemplate(template);
  return {
    id: template.id,
    channel: template.channel || "email",
    name: template.name,
    category: template.category,
    subject: template.subject,
    body: textFromBlocks(contentBlocks),
    imageUrls: imageUrlsFromBlocks(contentBlocks),
    contentBlocks,
  };
}

function safeLinkUrl(value: string) {
  const url = value.trim();
  if (!url) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(url)) return url;
  return `https://${url}`;
}

export function CrmTemplateManager({
  initialTemplates,
}: {
  initialTemplates: CrmEmailTemplate[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [form, setForm] = useState<TemplateForm>(() => newEmptyTemplate());
  const [query, setQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<"all" | "email" | "whatsapp">("all");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [isEditing, setIsEditing] = useState(initialTemplates.length === 0);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [toolboxTab, setToolboxTab] = useState<"modules" | "sections">("modules");
  const selectedTextRange = useRef<Range | null>(null);

  useEffect(() => {
    const rememberSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
      const range = selection.getRangeAt(0);
      const element = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer as Element
        : range.commonAncestorContainer.parentElement;
      if (element?.closest("[data-template-block-id] [contenteditable='true']")) {
        selectedTextRange.current = range.cloneRange();
      }
    };
    document.addEventListener("selectionchange", rememberSelection);
    return () => document.removeEventListener("selectionchange", rememberSelection);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("admin-editor-mode", { detail: { active: isEditing } }));
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      window.dispatchEvent(new CustomEvent("admin-editor-mode", { detail: { active: false } }));
    };
  }, [isEditing]);

  const categories = useMemo(() => {
    const values = new Set(["Todas", ...templates.map((template) => template.category || "General")]);
    return Array.from(values);
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return templates.filter((template) => {
      if (channelFilter !== "all" && (template.channel || "email") !== channelFilter) return false;
      if (categoryFilter !== "Todas" && template.category !== categoryFilter) return false;
      if (!needle) return true;
      return [
        template.name,
        template.category,
        template.subject,
        template.body,
        ...(template.contentBlocks || []).map((block) => {
          if (block.type === "text") return `${block.text} ${block.html || ""}`;
          if (block.type === "button") return `${block.label} ${block.url}`;
          if (block.type === "divider") return "separador";
          if (block.type === "spacer") return "espacio";
          if (block.type === "attachment") return block.name;
          if (block.type === "columns") return block.columns.map((column) => column.type === "text" ? `${column.text} ${column.html || ""}` : column.url).join(" ");
          return block.url;
        }),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [categoryFilter, channelFilter, query, templates]);

  const syncBlocks = (blocks: TemplateContentBlock[]) => ({
    contentBlocks: blocks,
    body: textFromBlocks(blocks),
    imageUrls: imageUrlsFromBlocks(blocks),
  });

  const selectedBlock = form.contentBlocks.find((block) => block.id === selectedBlockId) || form.contentBlocks[0];

  const update =
    (field: "name" | "category" | "subject" | "body") =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      setError("");
      setNotice("");
    };

  const updateWhatsAppBody = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const body = event.target.value;
    const textBlock = newTextBlock(body);
    setForm((current) => ({
      ...current,
      body,
      imageUrls: [],
      contentBlocks: [{ ...textBlock, id: current.contentBlocks[0]?.id || textBlock.id }],
    }));
    setError("");
    setNotice("");
  };

  const changeChannel = (channel: "email" | "whatsapp") => {
    setForm((current) => {
      if (current.channel === channel) return current;
      const body = channel === "whatsapp" ? DEFAULT_WHATSAPP_BODY : DEFAULT_BODY;
      const textBlock = newTextBlock(body);
      setSelectedBlockId(textBlock.id);
      return {
        ...newEmptyTemplate(channel),
        id: current.id,
        name: current.name,
        channel,
        body,
        contentBlocks: [textBlock],
      };
    });
  };

  const startNew = () => {
    const nextForm = newEmptyTemplate();
    setForm(nextForm);
    setSelectedBlockId(nextForm.contentBlocks[0]?.id || null);
    setIsEditing(true);
    setError("");
    setNotice("");
  };

  const startEdit = (template: CrmEmailTemplate) => {
    const nextForm = templateToForm(template);
    setForm(nextForm);
    setSelectedBlockId(nextForm.contentBlocks[0]?.id || null);
    setIsEditing(true);
    setError("");
    setNotice("");
  };

  const updateTextBlock = (
    id: string,
    patch: Partial<Extract<TemplateContentBlock, { type: "text" }>>
  ) => {
    setForm((current) => {
      const blocks = current.contentBlocks.map((block) =>
        block.id === id && block.type === "text"
          ? {
              ...block,
              ...patch,
              text: patch.html !== undefined ? stripHtml(patch.html) : patch.text ?? block.text,
            }
          : block
      );
      return { ...current, ...syncBlocks(blocks) };
    });
  };

  const updateImageBlock = (
    id: string,
    patch: Partial<Extract<TemplateContentBlock, { type: "image" }>>
  ) => {
    setForm((current) => {
      const blocks = current.contentBlocks.map((block) =>
        block.id === id && block.type === "image" ? { ...block, ...patch } : block
      );
      return { ...current, ...syncBlocks(blocks) };
    });
  };

  const updateButtonBlock = (
    id: string,
    patch: Partial<Extract<TemplateContentBlock, { type: "button" }>>
  ) => {
    setForm((current) => {
      const blocks = current.contentBlocks.map((block) =>
        block.id === id && block.type === "button" ? { ...block, ...patch } : block
      );
      return { ...current, ...syncBlocks(blocks) };
    });
  };

  const updateDividerBlock = (
    id: string,
    patch: Partial<Extract<TemplateContentBlock, { type: "divider" }>>
  ) => {
    setForm((current) => {
      const blocks = current.contentBlocks.map((block) =>
        block.id === id && block.type === "divider" ? { ...block, ...patch } : block
      );
      return { ...current, ...syncBlocks(blocks) };
    });
  };

  const updateSpacerBlock = (
    id: string,
    patch: Partial<Extract<TemplateContentBlock, { type: "spacer" }>>
  ) => {
    setForm((current) => {
      const blocks = current.contentBlocks.map((block) =>
        block.id === id && block.type === "spacer" ? { ...block, ...patch } : block
      );
      return { ...current, ...syncBlocks(blocks) };
    });
  };

  const updateColumnsBlock = (
    id: string,
    patch: Partial<Extract<TemplateContentBlock, { type: "columns" }>>
  ) => {
    setForm((current) => {
      const blocks = current.contentBlocks.map((block) =>
        block.id === id && block.type === "columns" ? { ...block, ...patch } : block
      );
      return { ...current, ...syncBlocks(blocks) };
    });
  };

  const addBlock = (block: TemplateContentBlock) => {
    setForm((current) => {
      const blocks = [...current.contentBlocks, block];
      return { ...current, ...syncBlocks(blocks) };
    });
    setSelectedBlockId(block.id);
  };

  const addTextBlock = () => addBlock(newTextBlock(""));
  const addTitleBlock = () => addBlock(newTitleBlock());
  const addButtonBlock = () => addBlock(newButtonBlock());
  const addDividerBlock = () => addBlock(newDividerBlock());
  const addSpacerBlock = () => addBlock(newSpacerBlock());
  const addColumnsBlock = () => addBlock(newColumnsBlock());
  const addSectionBlock = (widths: number[]) => addBlock(newColumnsBlock(widths));

  const uploadColumnImage = async (blockId: string, columnIndex: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setIsUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("files", file);
      formData.append("folder", "templates");
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const data = (await response.json().catch(() => null)) as { urls?: string[]; error?: string } | null;
      if (!response.ok || !data?.urls?.[0]) throw new Error(data?.error || "No se pudo subir la imagen");
      setForm((current) => {
        const blocks = current.contentBlocks.map((block) => {
          if (block.id !== blockId || block.type !== "columns") return block;
          const columns = [...block.columns];
          columns[columnIndex] = { type: "image", url: data.urls![0], alt: "", borderRadius: 8 };
          return { ...block, columns };
        });
        return { ...current, ...syncBlocks(blocks) };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la imagen");
    } finally {
      setIsUploading(false);
    }
  };

  const addFinancingSection = () => {
    const blocks: TemplateContentBlock[] = [
      { ...newDividerBlock(), width: 100 },
      { ...newTitleBlock(), text: "Financiación", html: "<h2>Financiación</h2>", fontSize: 28 },
      {
        ...newTextBlock("Anticipo: 30%\nSaldo: 24 cuotas en USD\nRefuerzos: a definir\n\nLa propuesta puede adaptarse según la unidad seleccionada."),
        html: "<p><strong>Anticipo:</strong> 30%</p><p><strong>Saldo:</strong> 24 cuotas en USD</p><p><strong>Refuerzos:</strong> a definir</p><p>La propuesta puede adaptarse según la unidad seleccionada.</p>",
        backgroundColor: "#f2f8f7",
        padding: 24,
      },
      { ...newButtonBlock(), label: "Consultar plan de financiación" },
    ];
    setForm((current) => ({ ...current, ...syncBlocks([...current.contentBlocks, ...blocks]) }));
    setSelectedBlockId(blocks[1].id);
  };

  const duplicateBlock = (id: string) => {
    setForm((current) => {
      const index = current.contentBlocks.findIndex((block) => block.id === id);
      if (index < 0) return current;
      const block = current.contentBlocks[index];
      const duplicate = { ...block, id: crypto.randomUUID() } as TemplateContentBlock;
      const blocks = [...current.contentBlocks];
      blocks.splice(index + 1, 0, duplicate);
      setSelectedBlockId(duplicate.id);
      return { ...current, ...syncBlocks(blocks) };
    });
  };

  const addLinkToTextBlock = (id: string) => {
    const label = window.prompt("Texto visible del link");
    if (!label) return;
    const rawUrl = window.prompt("URL del link");
    const url = rawUrl ? safeLinkUrl(rawUrl) : "";
    if (!url) return;

    setForm((current) => {
      const blocks = current.contentBlocks.map((block) => {
        if (block.id !== id || block.type !== "text") return block;
        const linkHtml = `<p><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a></p>`;
        const html = `${block.html || textToHtml(block.text)}${linkHtml}`;
        return { ...block, html, text: stripHtml(html) };
      });
      return { ...current, ...syncBlocks(blocks) };
    });
  };

  const applyTextCommand = (command: string, value?: string) => {
    if (selectedBlock?.type !== "text") return;

    const editor = window.document.querySelector<HTMLElement>(
      `[data-template-block-id="${selectedBlock.id}"] [contenteditable="true"]`
    );
    if (!editor) return;

    editor.focus();
    const selection = window.getSelection();
    const savedRange = selectedTextRange.current;
    if (selection && savedRange && editor.contains(savedRange.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
    }
    if (command === "foreColor" && value && selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed) {
      const range = selection.getRangeAt(0);
      const span = document.createElement("span");
      span.style.color = value;
      span.appendChild(range.extractContents());
      range.insertNode(span);
      selection.removeAllRanges();
      const selectedSpanRange = document.createRange();
      selectedSpanRange.selectNodeContents(span);
      selection.addRange(selectedSpanRange);
      updateTextBlock(selectedBlock.id, { html: editor.innerHTML });
      selectedTextRange.current = selection.getRangeAt(0).cloneRange();
      return;
    }
    window.document.execCommand(command, false, value);
    updateTextBlock(selectedBlock.id, { html: editor.innerHTML });
  };

  const applyTextSize = (fontSize: number) => {
    if (selectedBlock?.type !== "text") return;
    const editor = window.document.querySelector<HTMLElement>(`[data-template-block-id="${selectedBlock.id}"] [contenteditable="true"]`);
    if (!editor) return;
    const selection = window.getSelection();
    const savedRange = selectedTextRange.current;
    editor.focus();
    if (selection && savedRange && editor.contains(savedRange.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
      window.document.execCommand("fontSize", false, "7");
      editor.querySelectorAll<HTMLFontElement>('font[size="7"]').forEach((font) => {
        font.removeAttribute("size");
        font.style.fontSize = `${fontSize}px`;
      });
      updateTextBlock(selectedBlock.id, { html: editor.innerHTML });
      return;
    }
    updateTextBlock(selectedBlock.id, { fontSize });
  };

  const applyFontFamily = (fontFamily: string) => {
    if (selectedBlock?.type !== "text" || !fontFamily) return;

    const editor = window.document.querySelector<HTMLElement>(
      `[data-template-block-id="${selectedBlock.id}"] [contenteditable="true"]`
    );
    if (!editor) return;

    const selection = window.getSelection();
    const savedRange = selectedTextRange.current;
    editor.focus();
    if (selection && savedRange && editor.contains(savedRange.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
    }
    const hasSelection = Boolean(selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed && editor.contains(selection.anchorNode));

    if (hasSelection) {
      window.document.execCommand("fontName", false, fontFamily);
    } else {
      const nextHtml = `<div style="font-family: ${escapeHtml(fontFamily)};">${editor.innerHTML}</div>`;
      editor.innerHTML = nextHtml;
    }

    updateTextBlock(selectedBlock.id, { html: editor.innerHTML });
  };

  const insertVariable = (field: "subject" | "body", token: string) => {
    if (field === "subject") {
      setForm((current) => ({
        ...current,
        subject: `${current.subject} ${token}`.trim(),
      }));
      return;
    }

    setForm((current) => {
      const selectedIndex =
        selectedBlockId !== null
          ? current.contentBlocks.findIndex((block) => block.id === selectedBlockId && block.type === "text")
          : -1;
      const lastTextIndex = [...current.contentBlocks].reverse().findIndex((block) => block.type === "text");
      const targetIndex =
        selectedIndex >= 0
          ? selectedIndex
          : lastTextIndex === -1
            ? -1
            : current.contentBlocks.length - 1 - lastTextIndex;
      const tokenHtml = `<span>${escapeHtml(token)}</span>`;
      const blocks =
        targetIndex === -1
          ? [...current.contentBlocks, { ...newTextBlock(token), html: tokenHtml }]
          : current.contentBlocks.map((block, index) => {
              if (index !== targetIndex || block.type !== "text") return block;
              const html = `${block.html || textToHtml(block.text)} ${tokenHtml}`;
              return { ...block, html, text: stripHtml(html) };
            });

      return { ...current, ...syncBlocks(blocks) };
    });
  };

  const removeBlock = (id: string) => {
    setForm((current) => {
      const blocks = current.contentBlocks.filter((block) => block.id !== id);
      const normalizedBlocks = blocks.length ? blocks : [newTextBlock("")];
      if (selectedBlockId === id) setSelectedBlockId(normalizedBlocks[0]?.id || null);
      return { ...current, ...syncBlocks(normalizedBlocks) };
    });
  };

  const moveBlock = (id: string, targetId: string) => {
    if (id === targetId) return;
    setForm((current) => {
      const fromIndex = current.contentBlocks.findIndex((block) => block.id === id);
      const toIndex = current.contentBlocks.findIndex((block) => block.id === targetId);
      if (fromIndex < 0 || toIndex < 0) return current;
      const blocks = [...current.contentBlocks];
      const [block] = blocks.splice(fromIndex, 1);
      blocks.splice(toIndex, 0, block);
      return { ...current, ...syncBlocks(blocks) };
    });
  };

  const moveBlockByDirection = (id: string, direction: -1 | 1) => {
    setForm((current) => {
      const index = current.contentBlocks.findIndex((block) => block.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.contentBlocks.length) return current;
      const blocks = [...current.contentBlocks];
      const [block] = blocks.splice(index, 1);
      blocks.splice(nextIndex, 0, block);
      return { ...current, ...syncBlocks(blocks) };
    });
  };

  const uploadImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;
    await uploadFiles(files, "image");
  };

  const uploadAttachments = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;
    await uploadFiles(files, "attachment");
  };

  const uploadPlans = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;
    await uploadFiles(files, "plan");
  };

  const uploadFiles = async (files: File[], kind: "image" | "attachment" | "plan") => {
    setIsUploading(true);
    setError("");
    setNotice("");

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      formData.append("folder", "templates");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as
        | { urls?: string[]; error?: string }
        | null;

      if (!response.ok || !data?.urls) {
        throw new Error(data?.error || "No se pudieron subir los archivos");
      }

      setForm((current) => {
        const uploadedBlocks: TemplateContentBlock[] =
          kind === "image"
            ? data.urls!.map((url) => ({
                id: crypto.randomUUID(),
                type: "image",
                url,
                width: 100,
                align: "center",
                alt: "",
                borderRadius: 12,
                caption: "",
                linkUrl: "",
              }))
            : kind === "attachment"
              ? data.urls!.map((url, index) => ({
                id: crypto.randomUUID(),
                type: "attachment",
                url,
                name: files[index]?.name || `Adjunto ${index + 1}`,
              }))
              : data.urls!.map((url, index) => files[index]?.type.startsWith("image/")
                ? ({ id: crypto.randomUUID(), type: "image", url, width: 100, align: "center", alt: `Plano de {{desarrollo}}`, borderRadius: 6, caption: `Plano · {{desarrollo}}`, linkUrl: "" })
                : ({ id: crypto.randomUUID(), type: "attachment", url, name: files[index]?.name || `Plano ${index + 1}` }));

        const newBlocks: TemplateContentBlock[] = kind === "plan"
          ? [{ ...newTitleBlock(), text: "Planos y tipologías", html: "<h2>Planos y tipologías</h2>", fontSize: 28 }, ...uploadedBlocks]
          : uploadedBlocks;

        const blocks = [...current.contentBlocks, ...newBlocks];
        setSelectedBlockId(newBlocks[0]?.id || current.contentBlocks[0]?.id || null);
        return { ...current, ...syncBlocks(blocks) };
      });
      setNotice(`${data.urls.length} archivo${data.urls.length !== 1 ? "s" : ""} agregado${data.urls.length !== 1 ? "s" : ""}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron subir los archivos");
    } finally {
      setIsUploading(false);
    }
  };

  const startImageResize = (
    event: PointerEvent<HTMLButtonElement>,
    block: Extract<TemplateContentBlock, { type: "image" }>
  ) => {
    event.preventDefault();
    const container = event.currentTarget.closest("[data-image-resize-root]");
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      const nextWidth = Math.round(((moveEvent.clientX - rect.left) / rect.width) * 100);
      updateImageBlock(block.id, { width: Math.min(100, Math.max(25, nextWidth)) });
    };
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const saveTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const isWhatsApp = form.channel === "whatsapp";
      const payload = {
        ...form,
        subject: isWhatsApp ? form.subject || "Mensaje de WhatsApp" : form.subject,
        body: isWhatsApp ? form.body.trim() : textFromBlocks(form.contentBlocks),
        imageUrls: isWhatsApp ? [] : imageUrlsFromBlocks(form.contentBlocks),
        contentBlocks: isWhatsApp ? [] : form.contentBlocks,
      };
      const response = await fetch("/api/crm/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as
        | { template?: CrmEmailTemplate; error?: string }
        | null;

      if (!response.ok || !data?.template) {
        throw new Error(data?.error || "No se pudo guardar la plantilla");
      }

      setTemplates((current) => {
        const withoutTemplate = current.filter((template) => template.id !== data.template!.id);
        return [data.template!, ...withoutTemplate];
      });
      setForm(templateToForm(data.template));
      setIsEditing(false);
      setNotice("Plantilla guardada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la plantilla");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTemplate = async (template: CrmEmailTemplate) => {
    const confirmed = window.confirm(`¿Eliminar la plantilla "${template.name}"?`);
    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/crm/templates?id=${encodeURIComponent(template.id)}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "No se pudo eliminar la plantilla");
      setTemplates((current) => current.filter((item) => item.id !== template.id));
      if (form.id === template.id) setForm(newEmptyTemplate());
      setNotice("Plantilla eliminada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la plantilla");
    }
  };

  return (
    <div className={`min-h-[calc(100vh-3.5rem)] bg-[#f7f7f5] text-ink ${isEditing ? "border-0" : "rounded-xl border border-ink/12"}`}>
      {!isEditing && <header className="border-b border-ink/12 bg-white px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink/45">
              CRM / Correos
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              Plantillas
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink/60">
              Armá plantillas para correo con diseño visual o mensajes de WhatsApp con variables.
            </p>
          </div>
          <button
            type="button"
            onClick={startNew}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#005c5c] px-5 text-sm font-medium text-white transition-colors hover:bg-[#004949]"
          >
            <Plus className="h-4 w-4" />
            Crear plantilla
          </button>
        </div>
      </header>}

      {(error || notice) && (
        <div className="px-5 pt-4">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              {notice}
            </p>
          )}
        </div>
      )}

      <div className={`grid gap-0 ${isEditing ? "" : "lg:grid-cols-[320px_1fr]"}`}>
        {!isEditing && (
          <aside className="border-b border-ink/12 bg-white p-5 lg:border-b-0 lg:border-r">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-11 w-full rounded-full border border-ink/20 bg-white pl-9 pr-4 text-sm text-ink outline-none placeholder:text-ink/45 focus:border-[#005c5c]"
                placeholder="Buscar plantilla"
              />
            </label>

            <div className="mt-6 space-y-1">
              {[
                { value: "all", label: "Todas", count: templates.length },
                {
                  value: "email",
                  label: "Correo",
                  count: templates.filter((item) => (item.channel || "email") === "email").length,
                },
                {
                  value: "whatsapp",
                  label: "WhatsApp",
                  count: templates.filter((item) => item.channel === "whatsapp").length,
                },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setChannelFilter(item.value as "all" | "email" | "whatsapp")}
                  className={`flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-sm font-medium transition-colors ${
                    channelFilter === item.value
                      ? "bg-[#005c5c] text-white"
                      : "text-ink/65 hover:bg-cream-100 hover:text-ink"
                  }`}
                >
                  <span>{item.label}</span>
                  <span>{item.count}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-1 border-t border-ink/12 pt-5">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  className={`flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-sm font-medium transition-colors ${
                    categoryFilter === category
                      ? "bg-ink text-white"
                      : "text-ink/65 hover:bg-cream-100 hover:text-ink"
                  }`}
                >
                  <span>{category}</span>
                  <span>{category === "Todas" ? templates.length : templates.filter((item) => item.category === category).length}</span>
                </button>
              ))}
            </div>
          </aside>
        )}

        <main className={isEditing ? "p-0" : "p-5"}>
          {isEditing ? (
            <form
              onSubmit={saveTemplate}
              className="min-h-[calc(100vh-3.5rem)] bg-[#f1f2f2]"
            >
              <div className="sticky top-0 z-20 border-b border-ink/12 bg-white px-4 py-2.5 text-ink shadow-sm">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="rounded-lg border border-ink/15 px-3 py-2 text-xs font-semibold text-ink/70 transition-colors hover:bg-[#eef6f5] hover:text-[#005c5c]"
                    >
                      Volver
                    </button>
                    <div>
                      <p className="text-xs font-medium text-ink/45">Plantillas / Editor visual</p>
                      <h2 className="text-base font-semibold tracking-tight">
                        {form.id ? "Editar correo" : "Nuevo correo"}
                      </h2>
                    </div>
                  </div>

                  <div className={`grid gap-2 ${form.channel === "email" ? "md:grid-cols-[170px_minmax(220px,1fr)_110px_130px] xl:w-[720px]" : "md:grid-cols-[200px_140px_180px] xl:w-[560px]"}`}>
                    <input
                      value={form.name}
                      onChange={update("name")}
                      className="h-10 rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink outline-none placeholder:text-ink/40 focus:border-[#005c5c]"
                      placeholder="Nombre de plantilla"
                      required
                    />
                    {form.channel === "email" && (
                      <input
                        value={form.subject}
                        onChange={update("subject")}
                        className="h-10 min-w-0 rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink outline-none placeholder:text-ink/45 focus:border-[#005c5c]"
                        placeholder="Asunto del correo"
                        aria-label="Asunto del correo"
                        required
                      />
                    )}
                    <select
                      value={form.channel}
                      onChange={(event) => changeChannel(event.target.value as "email" | "whatsapp")}
                      className="h-10 rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink outline-none focus:border-[#005c5c]"
                    >
                      <option className="text-ink" value="email">Correo</option>
                      <option className="text-ink" value="whatsapp">WhatsApp</option>
                    </select>
                    <input
                      value={form.category}
                      onChange={update("category")}
                      className="h-10 rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink outline-none placeholder:text-ink/40 focus:border-[#005c5c]"
                      placeholder="Categoría"
                    />
                  </div>

                  <div className="hidden items-center rounded-lg border border-ink/15 bg-[#f7f8f8] p-0.5 2xl:flex">
                    <button type="button" className="rounded-md bg-white p-2 text-[#005c5c] shadow-sm" aria-label="Vista de escritorio"><Monitor className="h-4 w-4" /></button>
                    <button type="button" className="rounded-md p-2 text-ink/45" aria-label="Vista móvil"><Smartphone className="h-4 w-4" /></button>
                  </div>

                  <div className="hidden items-center gap-1 text-ink/35 2xl:flex">
                    <button type="button" disabled className="rounded-lg p-2" aria-label="Deshacer"><Undo2 className="h-4 w-4" /></button>
                    <button type="button" disabled className="rounded-lg p-2" aria-label="Rehacer"><Redo2 className="h-4 w-4" /></button>
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#005c5c] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#004949] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Guardar
                  </button>
                </div>
              </div>

              {form.channel === "whatsapp" ? (
                <WhatsAppTemplateEditor
                  body={form.body}
                  onBodyChange={updateWhatsAppBody}
                  onInsertVariable={(token) => {
                    setForm((current) => ({ ...current, body: `${current.body} ${token}`.trimStart() }));
                  }}
                />
              ) : (
              <div className="grid min-h-[calc(100vh-7.5rem)] lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(760px,1fr)_300px]">
                <aside className="border-b border-ink/12 bg-white lg:border-b-0 lg:border-r">
                  <div className="flex items-center justify-between border-b border-ink/12 px-4 py-4">
                    <h3 className="text-lg font-semibold text-ink">Agregar</h3>
                    <span className="text-xs font-medium text-ink/45">{form.contentBlocks.length} elementos</span>
                  </div>
                  <div className="grid grid-cols-2 border-b border-ink/12 text-sm font-medium">
                    <button type="button" onClick={() => setToolboxTab("modules")} className={`px-4 py-3 ${toolboxTab === "modules" ? "border-b-2 border-[#005c5c] text-[#005c5c]" : "text-ink/55"}`}>
                      Módulos
                    </button>
                    <button type="button" onClick={() => setToolboxTab("sections")} className={`px-4 py-3 ${toolboxTab === "sections" ? "border-b-2 border-[#005c5c] text-[#005c5c]" : "text-ink/55"}`}>
                      Secciones
                    </button>
                  </div>
                  <div className="space-y-4 p-3">
                    {toolboxTab === "modules" ? <>
                    <label className="relative block">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45" />
                      <input
                        className="h-10 w-full rounded-lg border border-ink/20 bg-white pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink/50 focus:border-[#005c5c]"
                        placeholder="Buscar módulos"
                      />
                    </label>

                    <ModuleGroup title="Módulos usados recientemente">
                      <ModuleTile icon={<Type className="h-5 w-5" />} title="Texto" description="Contenido editable" onClick={addTextBlock} />
                      <ModuleTile icon={<Columns2 className="h-5 w-5" />} title="2 columnas" description="Texto e imágenes lado a lado" onClick={addColumnsBlock} />
                      <ModuleTile icon={<Mail className="h-5 w-5" />} title="Botón" description="Llamada a la acción" onClick={addButtonBlock} />
                      <ModuleTile icon={<BadgePercent className="h-5 w-5" />} title="Financiación" description="Anticipo y cuotas" onClick={addFinancingSection} />
                      <label className="module-tile cursor-pointer" title="Foto o render">
                        <ImageIcon className="h-5 w-5 text-[#005c5c]" />
                        <span className="text-xs font-semibold text-ink">Imagen</span>
                        <input type="file" accept="image/*" multiple onChange={uploadImages} className="sr-only" />
                      </label>
                    </ModuleGroup>

                    <ModuleGroup title="Todos los módulos predeterminados (11)">
                      <ModuleTile
                        icon={<Type className="h-5 w-5" />}
                        title="Título"
                        description="Encabezado grande"
                        onClick={addTitleBlock}
                      />
                      <ModuleTile
                        icon={<Type className="h-5 w-5" />}
                        title="Texto"
                        description="Párrafo, títulos o listas"
                        onClick={addTextBlock}
                      />
                      <ModuleTile
                        icon={<Columns2 className="h-5 w-5" />}
                        title="2 columnas"
                        description="Dos contenidos lado a lado"
                        onClick={addColumnsBlock}
                      />
                      <ModuleTile
                        icon={<Mail className="h-5 w-5" />}
                        title="Botón"
                        description="CTA con link"
                        onClick={addButtonBlock}
                      />
                      <label className="module-tile cursor-pointer" title="Subir fotos al cuerpo del correo">
                        <span className="flex h-7 w-7 items-center justify-center text-[#005c5c]">
                          {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
                        </span>
                        <span className="text-xs font-semibold text-ink">Imagen</span>
                        <input type="file" accept="image/*" multiple onChange={uploadImages} className="sr-only" />
                      </label>
                      <label className="module-tile cursor-pointer" title="Subir imágenes o PDF con encabezado">
                        <span className="flex h-7 w-7 items-center justify-center text-[#005c5c]">
                          {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileImage className="h-5 w-5" />}
                        </span>
                        <span className="text-xs font-semibold text-ink">Planos</span>
                        <input type="file" accept="image/*,.pdf" multiple onChange={uploadPlans} className="sr-only" />
                      </label>
                      <ModuleTile
                        icon={<BadgePercent className="h-5 w-5" />}
                        title="Financiación"
                        description="Anticipo, cuotas y CTA"
                        onClick={addFinancingSection}
                      />
                      <label className="module-tile cursor-pointer" title="Adjuntar PDF, Excel o imagen">
                        <span className="flex h-7 w-7 items-center justify-center text-[#005c5c]">
                          {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
                        </span>
                        <span className="text-xs font-semibold text-ink">Adjunto</span>
                        <input
                          type="file"
                          accept=".pdf,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp"
                          multiple
                          onChange={uploadAttachments}
                          className="sr-only"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedBlock?.type === "text") {
                            addLinkToTextBlock(selectedBlock.id);
                          } else {
                            addTextBlock();
                          }
                        }}
                        className="module-tile"
                        title="Agregar un enlace dentro del texto"
                      >
                        <span className="flex h-7 w-7 items-center justify-center text-[#005c5c]">
                          <LinkIcon className="h-5 w-5" />
                        </span>
                        <span className="text-xs font-semibold text-ink">Link</span>
                      </button>
                      <ModuleTile
                        icon={<Minus className="h-5 w-5" />}
                        title="Separador"
                        description="Línea divisoria"
                        onClick={addDividerBlock}
                      />
                      <ModuleTile
                        icon={<GripVertical className="h-5 w-5" />}
                        title="Espacio"
                        description="Aire entre bloques"
                        onClick={addSpacerBlock}
                      />
                    </ModuleGroup>

                    <ModuleGroup title="Variables">
                      <VariableButtons prefix="toolbox" onPick={(token) => insertVariable("body", token)} />
                    </ModuleGroup>
                    </> : (
                      <section>
                        <h4 className="mb-3 text-sm font-semibold text-ink">Secciones predeterminadas</h4>
                        <p className="mb-3 text-xs leading-relaxed text-ink/55">Elegí una estructura y después definí texto o imagen en cada espacio.</p>
                        <div className="grid grid-cols-2 gap-2">
                          <SectionLayoutTile label="1" widths={[100]} onClick={addSectionBlock} />
                          <SectionLayoutTile label="2" widths={[50, 50]} onClick={addSectionBlock} />
                          <SectionLayoutTile label="3" widths={[33.33, 33.33, 33.34]} onClick={addSectionBlock} />
                          <SectionLayoutTile label="1/3 · 2/3" widths={[33.33, 66.67]} onClick={addSectionBlock} />
                          <SectionLayoutTile label="2/3 · 1/3" widths={[66.67, 33.33]} onClick={addSectionBlock} />
                          <SectionLayoutTile label="4" widths={[25, 25, 25, 25]} onClick={addSectionBlock} />
                        </div>
                      </section>
                    )}
                  </div>
                </aside>

                <section className="overflow-auto bg-[#f3f3f2] px-3 py-5 lg:px-6 xl:px-10">
                  <div className="mx-auto max-w-[1320px]">
                    <EditorToolbar
                      disabled={selectedBlock?.type !== "text"}
                      selectedBlock={selectedBlock}
                      onCommand={applyTextCommand}
                      onFontFamily={applyFontFamily}
                      onFontSize={applyTextSize}
                      onTextColor={(color) => {
                        applyTextCommand("foreColor", color);
                      }}
                      onAddLink={() => {
                        if (selectedBlock?.type === "text") addLinkToTextBlock(selectedBlock.id);
                      }}
                      onPickVariable={(token) => insertVariable("body", token)}
                    />

                    <div className="overflow-visible bg-white shadow-[0_4px_8px_rgba(21,20,21,0.08)]">
                      <div className="flex min-h-32 items-center justify-center border-b border-ink/8 bg-white px-8 text-center">
                        <div>
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-[#151415] font-serif text-2xl text-white">BB</div>
                          <p className="mt-3 text-xl font-semibold tracking-tight text-ink">Barrera Brokers</p>
                        </div>
                      </div>
                      <div className="border-b border-ink/10 px-5 py-4 sm:px-8">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold text-ink/55">Cuerpo del mail</p>
                            <p className="mt-1 text-xs text-ink/45">
                              Editá directo sobre la hoja. Seleccioná texto para darle formato o agregá módulos desde la izquierda.
                            </p>
                          </div>
                          <span className="rounded-full bg-[#f2fbfb] px-3 py-1 text-[11px] font-semibold text-[#005c5c]">
                            {form.contentBlocks.length} bloque{form.contentBlocks.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <div className="min-h-[620px] px-5 py-6 sm:px-10 xl:px-16">
                        {form.contentBlocks.map((block, index) => (
                          <TemplateBlockEditor
                            key={block.id}
                            block={block}
                            index={index}
                            total={form.contentBlocks.length}
                            draggedBlockId={draggedBlockId}
                            selected={selectedBlock?.id === block.id}
                            onSelect={() => setSelectedBlockId(block.id)}
                            onDragStart={() => setDraggedBlockId(block.id)}
                            onDragEnd={() => setDraggedBlockId(null)}
                            onDrop={() => {
                              if (draggedBlockId) moveBlock(draggedBlockId, block.id);
                              setDraggedBlockId(null);
                            }}
                            onMove={(direction) => moveBlockByDirection(block.id, direction)}
                            onDuplicate={() => duplicateBlock(block.id)}
                            onRemove={() => removeBlock(block.id)}
                            onTextChange={(html) => updateTextBlock(block.id, { html })}
                            onColorChange={(color) => updateTextBlock(block.id, { color })}
                            onAddLink={() => addLinkToTextBlock(block.id)}
                            onImageChange={(patch) => updateImageBlock(block.id, patch)}
                            onButtonChange={(patch) => updateButtonBlock(block.id, patch)}
                            onDividerChange={(patch) => updateDividerBlock(block.id, patch)}
                            onSpacerChange={(patch) => updateSpacerBlock(block.id, patch)}
                            onColumnsChange={(patch) => updateColumnsBlock(block.id, patch)}
                            onColumnImageUpload={(columnIndex, event) => uploadColumnImage(block.id, columnIndex, event)}
                            onImageResizeStart={(event) => {
                              if (block.type === "image") startImageResize(event, block);
                            }}
                          />
                        ))}
                        <div className="mt-3 grid gap-2 border-t border-ink/10 bg-white pt-3 sm:grid-cols-2 xl:grid-cols-8">
                          <button type="button" onClick={addTitleBlock} className="template-tool-button justify-center">
                            <Type className="h-4 w-4" />
                            Título
                          </button>
                          <button type="button" onClick={addTextBlock} className="template-tool-button justify-center">
                            <Type className="h-4 w-4" />
                            Texto
                          </button>
                          <button type="button" onClick={addColumnsBlock} className="template-tool-button justify-center">
                            <Columns2 className="h-4 w-4" />
                            2 columnas
                          </button>
                          <button type="button" onClick={addButtonBlock} className="template-tool-button justify-center">
                            <Mail className="h-4 w-4" />
                            Botón
                          </button>
                          <label className="template-tool-button cursor-pointer justify-center">
                            <ImageIcon className="h-4 w-4" />
                            Imagen
                            <input type="file" accept="image/*" multiple onChange={uploadImages} className="sr-only" />
                          </label>
                          <label className="template-tool-button cursor-pointer justify-center">
                            <FileImage className="h-4 w-4" />
                            Plano
                            <input type="file" accept="image/*,.pdf" multiple onChange={uploadPlans} className="sr-only" />
                          </label>
                          <button type="button" onClick={addFinancingSection} className="template-tool-button justify-center">
                            <BadgePercent className="h-4 w-4" />
                            Financiación
                          </button>
                          <label className="template-tool-button cursor-pointer justify-center">
                            <FileText className="h-4 w-4" />
                            Adjunto
                            <input
                              type="file"
                              accept=".pdf,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp"
                              multiple
                              onChange={uploadAttachments}
                              className="sr-only"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <TemplatePreview
                  form={form}
                  selectedBlock={selectedBlock}
                  onTextChange={(patch) => {
                    if (selectedBlock?.type === "text") updateTextBlock(selectedBlock.id, patch);
                  }}
                  onTextColor={(color) => {
                    if (selectedBlock?.type === "text") updateTextBlock(selectedBlock.id, { color });
                  }}
                  onAddLink={() => {
                    if (selectedBlock?.type === "text") addLinkToTextBlock(selectedBlock.id);
                  }}
                  onImageChange={(patch) => {
                    if (selectedBlock?.type === "image") updateImageBlock(selectedBlock.id, patch);
                  }}
                  onButtonChange={(patch) => {
                    if (selectedBlock?.type === "button") updateButtonBlock(selectedBlock.id, patch);
                  }}
                  onDividerChange={(patch) => {
                    if (selectedBlock?.type === "divider") updateDividerBlock(selectedBlock.id, patch);
                  }}
                  onSpacerChange={(patch) => {
                    if (selectedBlock?.type === "spacer") updateSpacerBlock(selectedBlock.id, patch);
                  }}
                />
              </div>
              )}
            </form>
          ) : (
            <section>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-ink">
                    Todas las plantillas
                  </h2>
                  <p className="mt-1 text-sm text-ink/55">
                    {filteredTemplates.length} plantilla{filteredTemplates.length !== 1 ? "s" : ""} disponible{filteredTemplates.length !== 1 ? "s" : ""}.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredTemplates.map((template) => (
                  <article key={template.id} className="overflow-hidden rounded-xl border border-ink/12 bg-white">
                    <div className="flex aspect-[4/3] items-center justify-center bg-cream-100">
                      {template.imageUrls[0] ? (
                        <img src={template.imageUrls[0]} alt="" className="h-full w-full object-cover" />
                      ) : template.channel === "whatsapp" ? (
                        <MessageCircle className="h-10 w-10 text-[#005c5c]/35" />
                      ) : (
                        <Mail className="h-10 w-10 text-ink/25" />
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink/45">
                          {template.category}
                        </p>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                          template.channel === "whatsapp"
                            ? "bg-[#e8f5e9] text-[#127236]"
                            : "bg-[#f2fbfb] text-[#005c5c]"
                        }`}>
                          {template.channel === "whatsapp" ? "WhatsApp" : "Correo"}
                        </span>
                      </div>
                      <h3 className="mt-2 text-base font-semibold text-ink">{template.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink/58">
                        {template.channel === "whatsapp" ? template.body : template.subject}
                      </p>
                      <p className="mt-2 text-xs text-ink/45">
                        {(template.contentBlocks?.length || template.imageUrls.length || 1)} bloque{(template.contentBlocks?.length || template.imageUrls.length || 1) !== 1 ? "s" : ""}
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(template)}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-ink/15 text-sm font-medium text-ink transition-colors hover:bg-cream-100"
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTemplate(template)}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
                        >
                          <Trash2 className="h-4 w-4" />
                          Borrar
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {filteredTemplates.length === 0 && (
                <div className="rounded-xl border border-dashed border-ink/15 bg-white px-5 py-16 text-center">
                  <Wand2 className="mx-auto h-8 w-8 text-ink/28" />
                  <p className="mt-3 text-sm font-semibold text-ink">Todavía no hay plantillas</p>
                  <p className="mt-1 text-sm text-ink/55">
                    Creá una plantilla para responder consultas más rápido.
                  </p>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function TemplateBlockEditor({
  block,
  index,
  total,
  draggedBlockId,
  selected,
  onSelect,
  onDragStart,
  onDragEnd,
  onDrop,
  onMove,
  onDuplicate,
  onRemove,
  onTextChange,
  onColorChange,
  onAddLink,
  onImageChange,
  onButtonChange,
  onDividerChange,
  onSpacerChange,
  onColumnsChange,
  onColumnImageUpload,
  onImageResizeStart,
}: {
  block: TemplateContentBlock;
  index: number;
  total: number;
  draggedBlockId: string | null;
  selected: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onTextChange: (html: string) => void;
  onColorChange: (color: string) => void;
  onAddLink: () => void;
  onImageChange: (patch: Partial<Extract<TemplateContentBlock, { type: "image" }>>) => void;
  onButtonChange: (patch: Partial<Extract<TemplateContentBlock, { type: "button" }>>) => void;
  onDividerChange: (patch: Partial<Extract<TemplateContentBlock, { type: "divider" }>>) => void;
  onSpacerChange: (patch: Partial<Extract<TemplateContentBlock, { type: "spacer" }>>) => void;
  onColumnsChange: (patch: Partial<Extract<TemplateContentBlock, { type: "columns" }>>) => void;
  onColumnImageUpload: (columnIndex: number, event: ChangeEvent<HTMLInputElement>) => void;
  onImageResizeStart: (event: PointerEvent<HTMLButtonElement>) => void;
}) {
  const isDraggingOver = draggedBlockId && draggedBlockId !== block.id;
  const columnTextRanges = useRef<Record<number, Range>>({});

  const rememberColumnSelection = (columnIndex: number) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      columnTextRanges.current[columnIndex] = selection.getRangeAt(0).cloneRange();
    }
  };

  const applyColumnInlineFormat = (columnIndex: number, command: string, value?: string, fontSize?: number) => {
    if (block.type !== "columns") return false;
    const editor = document.querySelector<HTMLElement>(`[data-template-block-id="${block.id}"] [data-column-index="${columnIndex}"]`);
    const range = columnTextRanges.current[columnIndex];
    if (!editor || !range || !editor.contains(range.commonAncestorContainer)) return false;
    editor.focus();
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    if (command === "foreColor" && value && !range.collapsed) {
      const span = document.createElement("span");
      span.style.color = value;
      span.appendChild(range.extractContents());
      range.insertNode(span);
      selection.removeAllRanges();
      const selectedSpanRange = document.createRange();
      selectedSpanRange.selectNodeContents(span);
      selection.addRange(selectedSpanRange);
      const columns = [...block.columns];
      const column = columns[columnIndex];
      if (column.type === "text") columns[columnIndex] = { ...column, html: editor.innerHTML, text: stripHtml(editor.innerHTML) };
      onColumnsChange({ columns });
      columnTextRanges.current[columnIndex] = selection.getRangeAt(0).cloneRange();
      return true;
    }
    document.execCommand(command, false, value);
    if (fontSize) {
      editor.querySelectorAll<HTMLFontElement>('font[size="7"]').forEach((font) => {
        font.removeAttribute("size");
        font.style.fontSize = `${fontSize}px`;
      });
    }
    const columns = [...block.columns];
    const column = columns[columnIndex];
    if (column.type === "text") columns[columnIndex] = { ...column, html: editor.innerHTML, text: stripHtml(editor.innerHTML) };
    onColumnsChange({ columns });
    return true;
  };

  return (
    <div
      data-template-block-id={block.id}
      onClick={onSelect}
      onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
      onDrop={onDrop}
      className={`group relative border px-1 py-1 transition-colors ${
        selected
          ? "border-[#005c5c]/35 ring-1 ring-[#005c5c]/10"
          : isDraggingOver
            ? "border-[#005c5c] bg-[#f2fbfb]"
            : "border-transparent hover:border-ink/10"
      }`}
    >
      <div className={`absolute right-2 top-2 z-30 items-center gap-1 rounded-xl border border-ink/12 bg-white p-1 shadow-[0_8px_24px_rgba(21,20,21,0.14)] lg:-right-10 lg:top-0 lg:flex-col lg:[&>div]:flex-col ${selected ? "flex" : "hidden group-hover:flex"}`}>
          <button
            type="button"
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          className="cursor-grab rounded-full p-1.5 text-ink/45 transition-colors hover:bg-cream-100 hover:text-ink active:cursor-grabbing"
            aria-label="Arrastrar bloque"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <BlockActions
          isFirst={index === 0}
          isLast={index === total - 1}
          onMoveUp={() => onMove(-1)}
          onMoveDown={() => onMove(1)}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
        />
      </div>

      {block.type === "text" && (
        <div className="py-1">
          <div
            contentEditable
            suppressContentEditableWarning
            onFocus={onSelect}
            onBlur={(event) => onTextChange(event.currentTarget.innerHTML)}
            className="min-h-12 px-1 py-1 pr-20 text-[15px] leading-7 text-ink outline-none"
            style={{
              color: block.color || "#1c1a17",
              fontFamily: block.fontFamily || EMAIL_FONTS[0].value,
              fontSize: `${block.fontSize || 16}px`,
              textAlign: block.align || "left",
              backgroundColor: block.backgroundColor || "#ffffff",
              padding: `${block.padding || 0}px`,
            }}
            dangerouslySetInnerHTML={{ __html: block.html || textToHtml(block.text) || "<p><br></p>" }}
          />
        </div>
      )}

      {block.type === "image" && (
        <div className="py-3">
          <div data-image-resize-root>
            <div
              className={`relative ${
                block.align === "left" ? "mr-auto" : block.align === "right" ? "ml-auto" : "mx-auto"
              }`}
              style={{ width: `${block.width}%` }}
            >
              <img
                src={block.url}
                alt={block.alt || ""}
                className="max-h-[520px] w-full object-contain"
                style={{ borderRadius: `${block.borderRadius ?? 12}px` }}
              />
              <button
                type="button"
                onPointerDown={onImageResizeStart}
                className="absolute -right-3 bottom-1/2 hidden h-7 w-7 translate-y-1/2 rounded-full border border-white bg-[#005c5c] text-white shadow-sm group-hover:block"
                aria-label="Cambiar tamaño de imagen"
                title="Arrastrar para cambiar tamaño"
              >
                ↔
              </button>
            </div>
            {block.caption && (
              <p className="mx-auto mt-2 max-w-[90%] text-center text-xs leading-relaxed text-ink/55">
                {variablePreview(block.caption)}
              </p>
            )}
          </div>
        </div>
      )}

      {block.type === "columns" && (
        <div
          className="grid items-stretch py-3"
          style={{
            gap: `${block.gap ?? 20}px`,
            gridTemplateColumns: (block.widths?.length === block.columns.length
              ? block.widths
              : block.columns.map(() => 100 / block.columns.length))
              .map((width) => `minmax(0, ${width}fr)`)
              .join(" "),
          }}
        >
          {block.columns.map((column, columnIndex) => {
            const replaceColumn = (next: typeof column) => {
              const columns = [...block.columns];
              columns[columnIndex] = next;
              onColumnsChange({ columns });
            };
            return (
              <div key={columnIndex} className="relative flex h-full min-h-32 flex-col border border-dashed border-ink/20 bg-white p-2">
                <div className="mb-2 flex items-center gap-1 border-b border-ink/10 pb-2">
                  <button
                    type="button"
                    onClick={() => replaceColumn({ type: "text", text: "", html: "<p><br></p>", color: "#1c1a17", fontSize: 16, fontFamily: EMAIL_FONTS[0].value, align: "left", bold: false })}
                    className={`rounded px-2 py-1 text-[11px] font-semibold ${column.type === "text" ? "bg-[#005c5c] text-white" : "text-ink/55 hover:bg-cream-100"}`}
                  >
                    Texto
                  </button>
                  <label className={`cursor-pointer rounded px-2 py-1 text-[11px] font-semibold ${column.type === "image" ? "bg-[#005c5c] text-white" : "text-ink/55 hover:bg-cream-100"}`}>
                    Imagen
                    <input type="file" accept="image/*" className="sr-only" onChange={(event) => onColumnImageUpload(columnIndex, event)} />
                  </label>
                </div>
                {column.type === "text" ? (
                  <>
                    <div className="mb-2 flex flex-wrap items-center gap-1 border-b border-ink/8 pb-2">
                      <select value={column.fontFamily || EMAIL_FONTS[0].value} onChange={(event) => { if (!applyColumnInlineFormat(columnIndex, "fontName", event.target.value)) replaceColumn({ ...column, fontFamily: event.target.value }); }} className="h-8 min-w-0 flex-1 rounded border border-ink/15 bg-white px-1 text-[10px] text-ink outline-none" aria-label="Tipo de letra">
                        {EMAIL_FONTS.slice(0, 5).map((font) => <option key={font.label} value={font.value}>{font.label}</option>)}
                      </select>
                      <select value={column.fontSize || 16} onChange={(event) => { const size = Number(event.target.value); if (!applyColumnInlineFormat(columnIndex, "fontSize", "7", size)) replaceColumn({ ...column, fontSize: size }); }} className="h-8 w-14 rounded border border-ink/15 bg-white px-1 text-[10px] text-ink outline-none" aria-label="Tamaño de letra">
                        {[12, 14, 16, 18, 20, 24, 28, 32].map((size) => <option key={size} value={size}>{size}</option>)}
                      </select>
                      <TextColorPalette compact onPick={(color) => { if (!applyColumnInlineFormat(columnIndex, "foreColor", color)) replaceColumn({ ...column, color }); }} />
                      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { if (!applyColumnInlineFormat(columnIndex, "bold")) replaceColumn({ ...column, bold: !column.bold }); }} className={`flex h-8 w-8 items-center justify-center rounded border border-ink/15 ${column.bold ? "bg-[#005c5c] text-white" : "text-ink/65"}`} title="Negrita"><Bold className="h-3.5 w-3.5" /></button>
                      {(["left", "center", "right"] as const).map((align) => <button key={align} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { if (!applyColumnInlineFormat(columnIndex, align === "left" ? "justifyLeft" : align === "center" ? "justifyCenter" : "justifyRight")) replaceColumn({ ...column, align }); }} className={`flex h-8 w-8 items-center justify-center rounded border border-ink/15 ${column.align === align ? "bg-[#005c5c] text-white" : "text-ink/65"}`} title={align === "left" ? "Izquierda" : align === "center" ? "Centrado" : "Derecha"}>{align === "left" ? <AlignLeft className="h-3.5 w-3.5" /> : align === "center" ? <AlignCenter className="h-3.5 w-3.5" /> : <AlignRight className="h-3.5 w-3.5" />}</button>)}
                    </div>
                    <div
                      contentEditable
                      data-column-index={columnIndex}
                      suppressContentEditableWarning
                      onMouseUp={() => rememberColumnSelection(columnIndex)}
                      onKeyUp={() => rememberColumnSelection(columnIndex)}
                      onBlur={(event) => replaceColumn({ ...column, html: event.currentTarget.innerHTML, text: stripHtml(event.currentTarget.innerHTML) })}
                      className="min-h-20 max-w-full overflow-hidden break-words px-1 py-1 text-sm leading-6 outline-none"
                      style={{ color: column.color || "#1c1a17", fontSize: `${column.fontSize || 16}px`, fontFamily: column.fontFamily || EMAIL_FONTS[0].value, textAlign: column.align || "left", fontWeight: column.bold ? 700 : 400 }}
                      dangerouslySetInnerHTML={{ __html: column.html || textToHtml(column.text) || "<p><br></p>" }}
                    />
                  </>
                ) : (
                  <div className="relative min-h-20 flex-1 overflow-hidden" style={{ borderRadius: `${column.borderRadius ?? 8}px` }}>
                    <img src={column.url} alt={column.alt || ""} className="absolute inset-0 h-full w-full object-cover" />
                    <button type="button" onClick={() => replaceColumn({ type: "text", text: "", html: "<p><br></p>", color: "#1c1a17", fontSize: 16, fontFamily: EMAIL_FONTS[0].value, align: "left", bold: false })} className="absolute right-1 top-1 rounded bg-white p-1.5 text-red-700 shadow-sm" aria-label="Eliminar imagen"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {block.type === "button" && (
        <div className="py-4" style={{ textAlign: block.align || "center" }}>
          <div className="inline-flex items-center gap-2">
            <input
              value={block.label}
              onChange={(event) => onButtonChange({ label: event.target.value })}
              className="min-h-12 rounded-full border border-transparent px-5 text-center text-sm font-bold outline-none focus:border-[#005c5c]"
              style={{
                backgroundColor: block.backgroundColor || "#005c5c",
                color: block.textColor || "#ffffff",
                borderRadius: `${block.borderRadius ?? 999}px`,
              }}
            />
          </div>
          <input
            value={block.url}
            onChange={(event) => onButtonChange({ url: event.target.value })}
            className="mx-auto mt-2 block h-9 w-full max-w-md rounded-lg border border-ink/12 bg-white px-3 text-xs text-ink/70 outline-none focus:border-[#005c5c]"
            placeholder="https://..."
          />
        </div>
      )}

      {block.type === "divider" && (
        <div className="py-5">
          <hr
            className="mx-auto border-0"
            style={{
              borderTop: `${block.thickness || 1}px solid ${block.color || "#d8d1c6"}`,
              width: `${block.width || 100}%`,
            }}
          />
        </div>
      )}

      {block.type === "spacer" && (
        <button
          type="button"
          onClick={onSelect}
          className="my-2 flex w-full items-center justify-center rounded-lg border border-dashed border-ink/15 bg-cream-50 text-xs font-semibold text-ink/45"
          style={{ height: `${block.height || 28}px` }}
        >
          Espacio {block.height || 28}px
        </button>
      )}

      {block.type === "attachment" && (
        <div className="py-2">
          <a
            href={block.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-3 rounded-lg border border-ink/12 bg-cream-50 px-3 text-sm font-medium text-[#005c5c] transition-colors hover:bg-cream-100"
          >
            <FileText className="h-4 w-4" />
            {block.name}
          </a>
        </div>
      )}
    </div>
  );
}

function VariableButtons({
  prefix,
  onPick,
}: {
  prefix: string;
  onPick: (token: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {VARIABLES.map((variable) => (
        <button
          key={`${prefix}-${variable.token}`}
          type="button"
          onClick={() => onPick(variable.token)}
          className="rounded-full border border-ink/12 px-2.5 py-1 text-[11px] font-medium text-ink/62 transition-colors hover:bg-cream-100 hover:text-ink"
        >
          {variable.label}
        </button>
      ))}
    </div>
  );
}

function WhatsAppTemplateEditor({
  body,
  onBodyChange,
  onInsertVariable,
}: {
  body: string;
  onBodyChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onInsertVariable: (token: string) => void;
}) {
  return (
    <div className="grid min-h-[calc(100vh-12rem)] bg-[#f3f3f2] lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="px-5 py-6 lg:px-8 xl:px-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 rounded-xl border border-ink/12 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/50">
                  Mensaje de WhatsApp
                </p>
                <p className="mt-1 text-sm text-ink/60">
                  El texto se abre en WhatsApp ya personalizado. El agente puede editarlo antes de enviarlo.
                </p>
              </div>
              <MessageCircle className="h-7 w-7 text-[#005c5c]" />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-ink/12 bg-white shadow-[0_18px_50px_rgba(21,20,21,0.10)]">
            <div className="border-b border-ink/10 bg-[#f7f7f5] px-5 py-4">
              <p className="text-sm font-semibold text-ink">Cuerpo del mensaje</p>
              <p className="mt-1 text-xs text-ink/50">
                Usá variables para que cada contacto reciba el mensaje con su nombre, desarrollo y propietario.
              </p>
            </div>
            <div className="p-5">
              <textarea
                value={body}
                onChange={onBodyChange}
                className="min-h-[460px] w-full resize-y rounded-xl border border-ink/12 bg-white p-5 text-lg leading-8 text-ink outline-none placeholder:text-ink/40 focus:border-[#005c5c]"
                placeholder={DEFAULT_WHATSAPP_BODY}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <VariableButtons prefix="whatsapp-editor" onPick={onInsertVariable} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside className="border-t border-ink/12 bg-white p-5 lg:border-l lg:border-t-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/50">
          Vista previa
        </p>
        <div className="mt-4 rounded-2xl bg-[#e8f5e9] p-4 text-sm leading-7 text-[#102316] shadow-sm">
          <p className="whitespace-pre-wrap">{variablePreview(body || DEFAULT_WHATSAPP_BODY)}</p>
        </div>
        <div className="mt-5 rounded-xl border border-ink/12 bg-cream-50 p-4">
          <p className="text-sm font-semibold text-ink">Variables disponibles</p>
          <div className="mt-3 space-y-2 text-xs text-ink/60">
            {VARIABLES.map((item) => (
              <button
                key={item.token}
                type="button"
                onClick={() => onInsertVariable(item.token)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-ink/10 bg-white px-3 py-2 text-left transition-colors hover:border-[#005c5c]/40"
              >
                <span>{item.label}</span>
                <code className="rounded bg-cream-100 px-1.5 py-0.5 text-[10px] text-ink/70">{item.token}</code>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function ModuleGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h4 className="mb-3 text-sm font-semibold text-ink">{title}</h4>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </section>
  );
}

function SectionLayoutTile({
  label,
  widths,
  onClick,
}: {
  label: string;
  widths: number[];
  onClick: (widths: number[]) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(widths)}
      className="flex min-h-24 flex-col items-center justify-center gap-3 rounded-lg border border-ink/20 bg-white p-3 text-xs font-semibold text-ink transition-colors hover:border-[#005c5c] hover:bg-[#f2fbfb] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#005c5c]/25"
    >
      <span className="flex h-8 w-full gap-1" aria-hidden="true">
        {widths.map((width, index) => (
          <span key={index} className="border border-ink/45 bg-white" style={{ flexBasis: `${width}%` }} />
        ))}
      </span>
      {label}
    </button>
  );
}

function ModuleTile({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="module-tile" title={description}>
      <span className="flex h-7 w-7 items-center justify-center text-[#005c5c]">
        {icon}
      </span>
      <span className="text-xs font-semibold text-ink">{title}</span>
    </button>
  );
}

function EditorToolbar({
  disabled,
  selectedBlock,
  onCommand,
  onFontFamily,
  onFontSize,
  onTextColor,
  onAddLink,
  onPickVariable,
}: {
  disabled: boolean;
  selectedBlock?: TemplateContentBlock;
  onCommand: (command: string, value?: string) => void;
  onFontFamily: (fontFamily: string) => void;
  onFontSize: (fontSize: number) => void;
  onTextColor: (color: string) => void;
  onAddLink: () => void;
  onPickVariable: (token: string) => void;
}) {
  return (
    <div className="sticky top-[72px] z-10 mb-4 rounded-xl border border-ink/12 bg-white/95 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold text-ink">Herramientas de edición</p>
          <p className="mt-0.5 text-xs text-ink/50">
            {disabled ? "Seleccioná un bloque de texto para activar formato." : "Formato activo sobre el bloque seleccionado."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            disabled={disabled}
            defaultValue=""
            onMouseDown={(event) => event.stopPropagation()}
            onChange={(event) => {
              onFontFamily(event.target.value);
              event.currentTarget.value = "";
            }}
            className="h-9 min-w-[160px] rounded-lg border border-ink/12 bg-white px-3 text-xs font-semibold text-ink/72 outline-none transition-colors hover:bg-cream-100 focus:border-[#005c5c] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Tipo de letra"
          >
            <option value="">Tipo de letra</option>
            {EMAIL_FONTS.slice(0, 5).map((font) => (
              <option key={font.label} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>
          <select
            disabled={disabled}
            value={selectedBlock?.type === "text" ? selectedBlock.fontSize || 16 : 16}
            onChange={(event) => onFontSize(Number(event.target.value))}
            className="h-9 w-20 rounded-lg border border-ink/12 bg-white px-2 text-xs font-semibold text-ink/72 outline-none focus:border-[#005c5c] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Tamaño de letra"
          >
            {[12, 14, 16, 18, 20, 24, 28, 32, 36, 42].map((size) => <option key={size} value={size}>{size}px</option>)}
          </select>
          <ToolbarButton label="Negrita" disabled={disabled} onClick={() => onCommand("bold")}>
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Cursiva" disabled={disabled} onClick={() => onCommand("italic")}>
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Subrayado" disabled={disabled} onClick={() => onCommand("underline")}>
            <Underline className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Lista" disabled={disabled} onClick={() => onCommand("insertUnorderedList")}>
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Lista numerada" disabled={disabled} onClick={() => onCommand("insertOrderedList")}>
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Izquierda" disabled={disabled} onClick={() => onCommand("justifyLeft")}>
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Centro" disabled={disabled} onClick={() => onCommand("justifyCenter")}>
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Derecha" disabled={disabled} onClick={() => onCommand("justifyRight")}>
            <AlignRight className="h-4 w-4" />
          </ToolbarButton>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onAddLink}
            disabled={disabled}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-ink/12 bg-white px-3 text-xs font-semibold text-ink/70 transition-colors hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <LinkIcon className="h-4 w-4" />
            Link
          </button>
          <TextColorPalette disabled={disabled} onPick={onTextColor} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
        <span className="text-xs font-semibold text-ink/55">Variables rápidas</span>
        {VARIABLES.map((variable) => (
          <button
            key={`toolbar-${variable.token}`}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPickVariable(variable.token)}
            className="rounded-full border border-ink/12 bg-[#f7f7f5] px-2.5 py-1 text-[11px] font-medium text-ink/68 transition-colors hover:bg-[#f2fbfb] hover:text-[#005c5c]"
          >
            {variable.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink/12 bg-white text-ink/70 transition-colors hover:bg-cream-100 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function BlockActions({
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRemove,
}: {
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onMoveUp}
        disabled={isFirst}
        className="rounded-md border border-ink/12 p-2 text-ink/65 transition-colors hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-35"
        aria-label="Subir bloque"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={isLast}
        className="rounded-md border border-ink/12 p-2 text-ink/65 transition-colors hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-35"
        aria-label="Bajar bloque"
      >
        ↓
      </button>
      <button
        type="button"
        onClick={onDuplicate}
        className="rounded-md border border-ink/12 p-2 text-ink/65 transition-colors hover:bg-cream-100"
        aria-label="Duplicar bloque"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-md border border-red-200 bg-red-50 p-2 text-red-700 transition-colors hover:bg-red-100"
        aria-label="Eliminar bloque"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function TemplateField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.16em] text-ink/52">
        {label}
      </span>
      {children}
    </label>
  );
}

function AlignPicker({
  value,
  onChange,
}: {
  value: "left" | "center" | "right";
  onChange: (value: "left" | "center" | "right") => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(["left", "center", "right"] as const).map((align) => (
        <button
          key={align}
          type="button"
          onClick={() => onChange(align)}
          className={`min-h-9 rounded-lg border text-xs font-medium ${
            value === align
              ? "border-[#005c5c] bg-[#e6f4f4] text-[#005c5c]"
              : "border-ink/12 bg-white text-ink/60 hover:bg-cream-100"
          }`}
        >
          {align === "left" ? "Izq." : align === "right" ? "Der." : "Centro"}
        </button>
      ))}
    </div>
  );
}

function RangeControl({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-ink/55">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[#005c5c]"
      />
    </label>
  );
}

function TemplatePreview({
  form,
  selectedBlock,
  onTextChange,
  onTextColor,
  onAddLink,
  onImageChange,
  onButtonChange,
  onDividerChange,
  onSpacerChange,
}: {
  form: TemplateForm;
  selectedBlock?: TemplateContentBlock;
  onTextChange: (patch: Partial<Extract<TemplateContentBlock, { type: "text" }>>) => void;
  onTextColor: (color: string) => void;
  onAddLink: () => void;
  onImageChange: (patch: Partial<Extract<TemplateContentBlock, { type: "image" }>>) => void;
  onButtonChange: (patch: Partial<Extract<TemplateContentBlock, { type: "button" }>>) => void;
  onDividerChange: (patch: Partial<Extract<TemplateContentBlock, { type: "divider" }>>) => void;
  onSpacerChange: (patch: Partial<Extract<TemplateContentBlock, { type: "spacer" }>>) => void;
}) {
  return (
    <aside className="border-t border-ink/12 bg-white xl:border-l xl:border-t-0">
      <div className="sticky top-[74px] space-y-4 p-4">
        <section className="rounded-xl border border-ink/12 bg-[#f7f7f5] p-4">
          <p className="text-xs font-semibold text-ink">Ajustes del bloque</p>
          {!selectedBlock && (
            <p className="mt-2 text-sm text-ink/55">Seleccioná un bloque para editarlo.</p>
          )}

          {selectedBlock?.type === "text" && (
            <div className="mt-4 space-y-3">
              <label className="block rounded-lg border border-ink/12 bg-white px-3 py-2 text-sm font-medium text-ink/70">
                Tipo de letra
                <select
                  value={selectedBlock.fontFamily || EMAIL_FONTS[0].value}
                  onChange={(event) => onTextChange({ fontFamily: event.target.value })}
                  className="mt-2 h-10 w-full rounded-lg border border-ink/12 bg-white px-3 text-xs outline-none focus:border-[#005c5c]"
                >
                  {EMAIL_FONTS.map((font) => (
                    <option key={font.label} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-ink/12 bg-white px-3 py-2 text-sm font-medium text-ink/70">
                Color del texto
                <input
                  type="color"
                  value={selectedBlock.color || "#1c1a17"}
                  onChange={(event) => onTextColor(event.target.value)}
                  className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0"
                />
              </label>
              <RangeControl label={`Tamaño ${selectedBlock.fontSize || 16}px`} min={12} max={42} value={selectedBlock.fontSize || 16} onChange={(fontSize) => onTextChange({ fontSize })} />
              <div>
                <p className="mb-2 text-xs font-semibold text-ink/55">Alineación</p>
                <AlignPicker value={selectedBlock.align || "left"} onChange={(align) => onTextChange({ align })} />
              </div>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-ink/12 bg-white px-3 py-2 text-sm font-medium text-ink/70">
                Fondo del bloque
                <input
                  type="color"
                  value={selectedBlock.backgroundColor || "#ffffff"}
                  onChange={(event) => onTextChange({ backgroundColor: event.target.value })}
                  className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0"
                />
              </label>
              <RangeControl label={`Padding ${selectedBlock.padding || 0}px`} min={0} max={48} value={selectedBlock.padding || 0} onChange={(padding) => onTextChange({ padding })} />
              <p className="rounded-lg bg-white px-3 py-2 text-xs leading-relaxed text-ink/50">
                El texto se edita directo en la hoja. Este panel controla el estilo general del bloque.
              </p>
              <button
                type="button"
                onClick={onAddLink}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-ink/12 bg-white text-sm font-medium text-[#005c5c] transition-colors hover:bg-cream-100"
              >
                <LinkIcon className="h-4 w-4" />
                Agregar link al texto
              </button>
            </div>
          )}

          {selectedBlock?.type === "image" && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold text-ink/55">Alineación</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["left", "center", "right"] as const).map((align) => (
                    <button
                      key={align}
                      type="button"
                      onClick={() => onImageChange({ align })}
                      className={`min-h-9 rounded-lg border text-xs font-medium ${
                        (selectedBlock.align || "center") === align
                          ? "border-[#005c5c] bg-[#e6f4f4] text-[#005c5c]"
                          : "border-ink/12 bg-white text-ink/60"
                      }`}
                    >
                      {align === "left" ? "Izq." : align === "right" ? "Der." : "Centro"}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-ink/55">
                  Tamaño {selectedBlock.width}%
                </span>
                <input
                  type="range"
                  min={25}
                  max={100}
                  value={selectedBlock.width}
                  onChange={(event) => onImageChange({ width: Number(event.target.value) })}
                  className="w-full accent-[#005c5c]"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-ink/55">
                  Bordes {selectedBlock.borderRadius ?? 12}px
                </span>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={selectedBlock.borderRadius ?? 12}
                  onChange={(event) => onImageChange({ borderRadius: Number(event.target.value) })}
                  className="w-full accent-[#005c5c]"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-ink/55">Texto alternativo</span>
                <input
                  value={selectedBlock.alt || ""}
                  onChange={(event) => onImageChange({ alt: event.target.value })}
                  className="h-10 w-full rounded-lg border border-ink/12 bg-white px-3 text-sm outline-none focus:border-[#005c5c]"
                  placeholder="Render del desarrollo"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-ink/55">Descripción visible</span>
                <input
                  value={selectedBlock.caption || ""}
                  onChange={(event) => onImageChange({ caption: event.target.value })}
                  className="h-10 w-full rounded-lg border border-ink/12 bg-white px-3 text-sm outline-none focus:border-[#005c5c]"
                  placeholder="Plano 2 ambientes · Unidad 4B"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-ink/55">Link al hacer clic</span>
                <input
                  value={selectedBlock.linkUrl || ""}
                  onChange={(event) => onImageChange({ linkUrl: event.target.value })}
                  className="h-10 w-full rounded-lg border border-ink/12 bg-white px-3 text-sm outline-none focus:border-[#005c5c]"
                  placeholder="https://..."
                />
              </label>
            </div>
          )}

          {selectedBlock?.type === "button" && (
            <div className="mt-4 space-y-3">
              <TemplateField label="Texto del botón">
                <input
                  value={selectedBlock.label}
                  onChange={(event) => onButtonChange({ label: event.target.value })}
                  className="h-10 w-full rounded-lg border border-ink/12 bg-white px-3 text-sm outline-none focus:border-[#005c5c]"
                />
              </TemplateField>
              <TemplateField label="Link">
                <input
                  value={selectedBlock.url}
                  onChange={(event) => onButtonChange({ url: event.target.value })}
                  className="h-10 w-full rounded-lg border border-ink/12 bg-white px-3 text-sm outline-none focus:border-[#005c5c]"
                />
              </TemplateField>
              <div className="grid grid-cols-2 gap-2">
                <label className="rounded-lg border border-ink/12 bg-white px-3 py-2 text-xs font-semibold text-ink/55">
                  Fondo
                  <input
                    type="color"
                    value={selectedBlock.backgroundColor || "#005c5c"}
                    onChange={(event) => onButtonChange({ backgroundColor: event.target.value })}
                    className="mt-2 h-8 w-full cursor-pointer border-0 bg-transparent p-0"
                  />
                </label>
                <label className="rounded-lg border border-ink/12 bg-white px-3 py-2 text-xs font-semibold text-ink/55">
                  Texto
                  <input
                    type="color"
                    value={selectedBlock.textColor || "#ffffff"}
                    onChange={(event) => onButtonChange({ textColor: event.target.value })}
                    className="mt-2 h-8 w-full cursor-pointer border-0 bg-transparent p-0"
                  />
                </label>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-ink/55">Alineación</p>
                <AlignPicker value={selectedBlock.align || "center"} onChange={(align) => onButtonChange({ align })} />
              </div>
            </div>
          )}

          {selectedBlock?.type === "divider" && (
            <div className="mt-4 space-y-4">
              <label className="flex items-center justify-between gap-3 rounded-lg border border-ink/12 bg-white px-3 py-2 text-sm font-medium text-ink/70">
                Color
                <input
                  type="color"
                  value={selectedBlock.color || "#d8d1c6"}
                  onChange={(event) => onDividerChange({ color: event.target.value })}
                  className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0"
                />
              </label>
              <RangeControl label={`Grosor ${selectedBlock.thickness || 1}px`} min={1} max={12} value={selectedBlock.thickness || 1} onChange={(value) => onDividerChange({ thickness: value })} />
              <RangeControl label={`Ancho ${selectedBlock.width || 100}%`} min={20} max={100} value={selectedBlock.width || 100} onChange={(value) => onDividerChange({ width: value })} />
            </div>
          )}

          {selectedBlock?.type === "spacer" && (
            <div className="mt-4">
              <RangeControl label={`Altura ${selectedBlock.height}px`} min={8} max={160} value={selectedBlock.height} onChange={(height) => onSpacerChange({ height })} />
            </div>
          )}

          {selectedBlock?.type === "attachment" && (
            <a
              href={selectedBlock.url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex min-h-10 items-center gap-2 rounded-lg border border-ink/12 bg-white px-3 text-sm font-medium text-[#005c5c]"
            >
              <FileText className="h-4 w-4" />
              {selectedBlock.name}
            </a>
          )}
        </section>

        <section className="rounded-xl border border-ink/12 bg-[#f7f7f5] p-4">
          <p className="text-xs font-semibold text-ink/55">Vista previa rápida</p>
          <h3 className="mt-1 text-sm font-semibold text-ink">
            {variablePreview(form.subject || "Asunto")}
          </h3>
          <div className="mt-3 max-h-[42vh] space-y-3 overflow-auto rounded-lg bg-white p-3 text-xs leading-relaxed text-ink/70">
            {form.contentBlocks.map((block) => {
              if (block.type === "text") {
                return (
                  <div
                    key={block.id}
                    style={{ color: block.color || "#1c1a17" }}
                    dangerouslySetInnerHTML={{
                      __html: variablePreview(block.html || textToHtml(block.text) || "Texto de la plantilla"),
                    }}
                  />
                );
              }
              if (block.type === "attachment") {
                return (
                  <p key={block.id} className="rounded-md border border-ink/12 bg-cream-50 px-3 py-2 font-medium text-[#005c5c]">
                    {block.name}
                  </p>
                );
              }
              if (block.type === "button") {
                return (
                  <p key={block.id} className={block.align === "left" ? "text-left" : block.align === "right" ? "text-right" : "text-center"}>
                    <span
                      className="inline-flex rounded-full px-4 py-2 text-xs font-bold"
                      style={{
                        backgroundColor: block.backgroundColor || "#005c5c",
                        color: block.textColor || "#ffffff",
                        borderRadius: `${block.borderRadius ?? 999}px`,
                      }}
                    >
                      {variablePreview(block.label)}
                    </span>
                  </p>
                );
              }
              if (block.type === "divider") {
                return (
                  <hr
                    key={block.id}
                    className="mx-auto border-0"
                    style={{
                      borderTop: `${block.thickness || 1}px solid ${block.color || "#d8d1c6"}`,
                      width: `${block.width || 100}%`,
                    }}
                  />
                );
              }
              if (block.type === "spacer") {
                return <div key={block.id} style={{ height: `${block.height}px` }} />;
              }
              if (block.type === "columns") {
                return (
                  <div key={block.id} className="grid items-stretch" style={{ gap: `${block.gap ?? 12}px`, gridTemplateColumns: (block.widths || block.columns.map(() => 1)).map((width) => `${width}fr`).join(" ") }}>
                    {block.columns.map((column, index) => column.type === "text" ? (
                      <div key={index} className="max-w-full overflow-hidden break-words" style={{ color: column.color || "#1c1a17", fontSize: `${column.fontSize || 14}px`, fontFamily: column.fontFamily, textAlign: column.align || "left", fontWeight: column.bold ? 700 : 400, overflowWrap: "anywhere" }} dangerouslySetInnerHTML={{ __html: variablePreview(column.html || textToHtml(column.text)) }} />
                    ) : (
                      <div key={index} className="relative h-full min-h-24 overflow-hidden" style={{ borderRadius: `${column.borderRadius ?? 8}px` }}><img src={column.url} alt={column.alt || ""} className="absolute inset-0 h-full w-full object-cover" /></div>
                    ))}
                  </div>
                );
              }
              return (
                <figure key={block.id}>
                  <img
                    src={block.url}
                    alt={block.alt || ""}
                    className={`max-h-40 rounded-lg object-contain ${
                      block.align === "left" ? "mr-auto" : block.align === "right" ? "ml-auto" : "mx-auto"
                    }`}
                    style={{ width: `${block.width}%` }}
                  />
                  {block.caption && <figcaption className="mt-1 text-center text-[11px] text-ink/50">{variablePreview(block.caption)}</figcaption>}
                </figure>
              );
            })}
          </div>
        </section>
      </div>
    </aside>
  );
}
