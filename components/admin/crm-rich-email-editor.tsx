"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type CSSProperties, type MouseEvent } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Braces, Highlighter, ImagePlus, Italic, Link, List, ListOrdered, Loader2, Palette, Redo2, RemoveFormatting, Trash2, Underline, Undo2 } from "lucide-react";
import type { CrmEmailTemplateContentBlock } from "@/lib/db";

type Blocks = CrmEmailTemplateContentBlock[];
type Bookmark = { key: string; start: number; end: number };
type EditorVariable = { token: string; label: string };
const FONTS = [["Arial", "Arial, Helvetica, sans-serif"], ["Helvetica", "Helvetica, Arial, sans-serif"], ["Verdana", "Verdana, Geneva, sans-serif"], ["Georgia", "Georgia, serif"], ["Trebuchet", "'Trebuchet MS', Arial, sans-serif"]] as const;
const COLORS = ["#1c1a17", "#ffffff", "#006b6b", "#004949", "#173d52", "#666666", "#9b1c1c", "#dc2626", "#d97706", "#eab308", "#15803d", "#2563eb", "#7c3aed", "#be185d", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#c9daf8", "#d9d2e9", "#ead1dc", "#cccccc", "#999999"];

function offsets(editor: HTMLElement, range: Range) {
  const start = document.createRange(); start.selectNodeContents(editor); start.setEnd(range.startContainer, range.startOffset);
  const end = document.createRange(); end.selectNodeContents(editor); end.setEnd(range.endContainer, range.endOffset);
  return { start: start.toString().length, end: end.toString().length };
}
function rangeAt(editor: HTMLElement, start: number, end: number) {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT); const range = document.createRange();
  let offset = 0, started = false, node = walker.nextNode();
  while (node) { const length = node.textContent?.length || 0; if (!started && start <= offset + length) { range.setStart(node, Math.max(0, start - offset)); started = true; } if (end <= offset + length) { range.setEnd(node, Math.max(0, end - offset)); return started ? range : null; } offset += length; node = walker.nextNode(); }
  return null;
}
function plain(html: string) { const node = document.createElement("div"); node.innerHTML = html; return node.innerText.trim(); }
function domKey(key: string) { return key.replace(/[^a-zA-Z0-9_-]/g, "_"); }

function StableRichText({ editorKey, html, style, onUpdate, onActivate, onRemember }: {
  editorKey: string;
  html: string;
  style: CSSProperties;
  onUpdate: (key: string, html: string) => void;
  onActivate: (key: string) => void;
  onRemember: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor || editor.innerHTML === html) return;
    editor.innerHTML = html;
  }, [html]);

  return <div
    ref={editorRef}
    data-editor-id={domKey(editorKey)}
    data-email-key={editorKey}
    contentEditable
    suppressContentEditableWarning
    onFocus={() => onActivate(editorKey)}
    onInput={(event) => onUpdate(editorKey, event.currentTarget.innerHTML)}
    onBlur={(event) => onUpdate(editorKey, event.currentTarget.innerHTML)}
    onMouseUp={onRemember}
    onKeyUp={onRemember}
    className="min-h-10 break-words rounded-md px-2 py-1.5 leading-relaxed outline-none hover:bg-[#f8faf9] focus:bg-white focus:ring-2 focus:ring-[#006b6b]/35"
    style={style}
  />;
}

export function CrmRichEmailEditor({ blocks, onChange, onNotice, variables = [] }: { blocks: Blocks; onChange: (blocks: Blocks) => void; onNotice: (message: string) => void; variables?: EditorVariable[] }) {
  const saved = useRef<Bookmark | null>(null); const palette = useRef<HTMLDetailsElement>(null); const highlightPalette = useRef<HTMLDetailsElement>(null); const variablesMenu = useRef<HTMLDetailsElement>(null); const fileInput = useRef<HTMLInputElement>(null);
  const [activeKey, setActiveKey] = useState(""); const [uploading, setUploading] = useState(false);
  const remember = useCallback(() => { const selection = window.getSelection(); if (!selection?.rangeCount) return; const range = selection.getRangeAt(0); const origin = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? range.commonAncestorContainer as HTMLElement : range.commonAncestorContainer.parentElement; const editor = origin?.closest<HTMLElement>("[data-email-key]"); const key = editor?.dataset.emailKey; if (editor && key) { setActiveKey(key); saved.current = { key, ...offsets(editor, range) }; } }, []);
  useEffect(() => { document.addEventListener("selectionchange", remember); return () => document.removeEventListener("selectionchange", remember); }, [remember]);
  const updateText = (key: string, html: string) => { const [id, column] = key.split("::"); onChange(blocks.map((block) => { if (block.id !== id) return block; if (block.type === "text" && column === undefined) return { ...block, html, text: plain(html) }; if (block.type === "columns" && column !== undefined) return { ...block, columns: block.columns.map((item, index) => index === Number(column) && item.type === "text" ? { ...item, html, text: plain(html) } : item) }; return block; })); };
  const restore = () => { if (!saved.current) return null; const editor = document.querySelector<HTMLElement>(`[data-editor-id="${domKey(saved.current.key)}"]`); if (!editor) return null; const range = rangeAt(editor, saved.current.start, saved.current.end); if (!range) return null; const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range); editor.focus(); return editor; };
  const command = (name: string, value?: string) => { const editor = restore(); if (!editor || !saved.current) return onNotice("Seleccioná el texto que querés modificar."); document.execCommand(name, false, value); updateText(saved.current.key, editor.innerHTML); remember(); };
  const styleSelection = (property: string, value: string) => { const editor = restore(), bookmark = saved.current, selection = window.getSelection(), range = selection?.rangeCount ? selection.getRangeAt(0) : null; if (!editor || !bookmark || !range || range.collapsed) return onNotice("Marcá una palabra o frase para aplicarle el formato."); const span = document.createElement("span"); span.style.setProperty(property, value); try { range.surroundContents(span); } catch { const fragment = range.extractContents(); span.append(fragment); range.insertNode(span); } updateText(bookmark.key, editor.innerHTML); const next = document.createRange(); next.selectNodeContents(span); selection?.removeAllRanges(); selection?.addRange(next); remember(); };
  const insertVariable = (token: string) => { const editor = restore(); if (!editor || !saved.current) return onNotice("Hacé clic dentro del mensaje donde querés colocar la variable."); document.execCommand("insertText", false, token); updateText(saved.current.key, editor.innerHTML); remember(); variablesMenu.current?.removeAttribute("open"); onNotice(`Variable agregada: ${token}`); };
  const keepSelection = (event: MouseEvent) => event.preventDefault();
  const upload = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; setUploading(true); try { const form = new FormData(); form.append("file", file); form.append("folder", "crm-email"); const response = await fetch("/api/upload", { method: "POST", body: form }); const data = await response.json().catch(() => null) as { url?: string; error?: string } | null; if (!response.ok || !data?.url) throw new Error(data?.error || "No se pudo cargar la imagen."); const image: CrmEmailTemplateContentBlock = { id: crypto.randomUUID(), type: "image", url: data.url, alt: file.name, width: 100, align: "center", borderRadius: 8 }; const index = blocks.findIndex((block) => block.id === activeKey.split("::")[0]); const next = [...blocks]; next.splice(index < 0 ? next.length : index + 1, 0, image); onChange(next); onNotice("Imagen agregada en el lugar elegido."); } catch (error) { onNotice(error instanceof Error ? error.message : "No se pudo cargar la imagen."); } finally { setUploading(false); } };
  const editable = (key: string, html: string, style: CSSProperties) => <StableRichText editorKey={key} html={html} style={style} onUpdate={updateText} onActivate={setActiveKey} onRemember={remember} />;
  const tool = "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink/15 bg-white text-ink/70 hover:bg-[#e7f4f2] hover:text-[#006b6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b] [&_svg]:h-4 [&_svg]:w-4";
  return <section className="mt-2 overflow-visible rounded-xl border border-ink/15 bg-[#f3f4f4]">
    <div className="sticky top-0 z-20 rounded-t-xl border-b border-ink/10 bg-white px-3 py-2 shadow-[0_2px_6px_rgba(0,0,0,0.06)]"><div className="flex flex-wrap items-center gap-1.5">
      <button type="button" onMouseDown={keepSelection} onClick={() => command("undo")} className={tool} aria-label="Deshacer" title="Deshacer"><Undo2 /></button><button type="button" onMouseDown={keepSelection} onClick={() => command("redo")} className={tool} aria-label="Rehacer" title="Rehacer"><Redo2 /></button><span className="mx-0.5 h-6 w-px bg-ink/10" />
      <select aria-label="Tipografía" defaultValue={FONTS[0][1]} onMouseDown={remember} onChange={(event) => styleSelection("font-family", event.target.value)} className="h-9 max-w-32 rounded-lg border border-ink/15 bg-white px-2 text-xs font-medium">{FONTS.map(([label, value]) => <option key={label} value={value}>{label}</option>)}</select>
      <select aria-label="Tamaño" defaultValue="16" onMouseDown={remember} onChange={(event) => styleSelection("font-size", `${event.target.value}px`)} className="h-9 w-20 rounded-lg border border-ink/15 bg-white px-2 text-xs font-medium">{[12, 14, 16, 18, 22, 26, 32].map((size) => <option key={size}>{size}</option>)}</select>
      <button type="button" onMouseDown={keepSelection} onClick={() => command("bold")} className={tool} aria-label="Negrita"><Bold /></button><button type="button" onMouseDown={keepSelection} onClick={() => command("italic")} className={tool} aria-label="Cursiva"><Italic /></button><button type="button" onMouseDown={keepSelection} onClick={() => command("underline")} className={tool} aria-label="Subrayado"><Underline /></button>
      <button type="button" onMouseDown={keepSelection} onClick={() => command("justifyLeft")} className={tool} aria-label="Izquierda"><AlignLeft /></button><button type="button" onMouseDown={keepSelection} onClick={() => command("justifyCenter")} className={tool} aria-label="Centrar"><AlignCenter /></button><button type="button" onMouseDown={keepSelection} onClick={() => command("justifyRight")} className={tool} aria-label="Derecha"><AlignRight /></button><button type="button" onMouseDown={keepSelection} onClick={() => command("insertUnorderedList")} className={tool} aria-label="Viñetas"><List /></button><button type="button" onMouseDown={keepSelection} onClick={() => command("insertOrderedList")} className={tool} aria-label="Numeración"><ListOrdered /></button>
      <details ref={palette} className="relative"><summary onMouseDown={keepSelection} className={`${tool} cursor-pointer list-none`} aria-label="Color"><Palette /></summary><div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-ink/15 bg-white p-3 shadow-xl sm:left-0 sm:right-auto"><p className="mb-2 text-xs font-semibold">Color del texto seleccionado</p><div className="grid grid-cols-8 gap-1.5">{COLORS.map((color) => <button key={color} type="button" onMouseDown={keepSelection} onClick={() => { styleSelection("color", color); palette.current?.removeAttribute("open"); }} className="h-6 w-6 rounded border border-black/15 hover:scale-110" style={{ backgroundColor: color }} aria-label={`Color ${color}`} />)}</div><label className="mt-3 flex items-center justify-between border-t border-ink/10 pt-2 text-xs font-medium">Personalizado<input type="color" defaultValue="#006b6b" onMouseDown={remember} onChange={(event) => { styleSelection("color", event.target.value); palette.current?.removeAttribute("open"); }} /></label></div></details>
      <details ref={highlightPalette} className="relative"><summary onMouseDown={keepSelection} className={`${tool} cursor-pointer list-none`} aria-label="Resaltar texto"><Highlighter /></summary><div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-ink/15 bg-white p-3 shadow-xl sm:left-0 sm:right-auto"><p className="mb-2 text-xs font-semibold">Color de resaltado</p><div className="grid grid-cols-6 gap-2">{["#fff2cc", "#d9ead3", "#c9daf8", "#ead1dc", "#f4cccc", "transparent"].map((color) => <button key={color} type="button" onMouseDown={keepSelection} onClick={() => { styleSelection("background-color", color); highlightPalette.current?.removeAttribute("open"); }} className="h-7 w-7 rounded border border-black/15" style={{ backgroundColor: color === "transparent" ? "#fff" : color }} aria-label={color === "transparent" ? "Quitar resaltado" : `Resaltado ${color}`} />)}</div></div></details>
      <button type="button" onMouseDown={keepSelection} onClick={() => { const url = window.prompt("Pegá el enlace completo"); if (url) command("createLink", url); }} className={tool} aria-label="Enlace"><Link /></button>
      <button type="button" onMouseDown={keepSelection} onClick={() => command("removeFormat")} className={tool} aria-label="Quitar formato" title="Quitar formato"><RemoveFormatting /></button>
      {variables.length > 0 && <details ref={variablesMenu} className="relative"><summary onMouseDown={keepSelection} className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-lg border border-[#006b6b] bg-white px-3 text-xs font-semibold text-[#006b6b] hover:bg-[#e7f4f2]"><Braces className="h-4 w-4" /> Variables</summary><div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-ink/15 bg-white p-2 shadow-xl"><p className="px-2 pb-2 text-xs font-semibold text-ink">Insertar en la posición del cursor</p>{variables.map((variable) => <button key={variable.token} type="button" onMouseDown={keepSelection} onClick={() => insertVariable(variable.token)} className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-[#e7f4f2]"><span className="font-medium text-ink">{variable.label}</span><code className="text-[10px] text-ink/55">{variable.token}</code></button>)}</div></details>}
      <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg border border-[#006b6b] px-3 text-xs font-semibold text-[#006b6b] hover:bg-[#e7f4f2] disabled:opacity-50">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Imagen</button><input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={upload} />
    </div><p className="mt-1.5 text-[11px] text-ink/60">Seleccioná texto para darle formato o hacé clic dentro del mensaje para insertar una variable.</p></div>
    <div className="max-h-[52vh] overflow-y-auto overscroll-contain px-2 py-4 sm:px-5"><div className="mx-auto w-full max-w-[640px] overflow-hidden rounded-lg bg-white px-4 py-5 shadow-sm sm:px-7">{blocks.map((block) => {
      if (block.type === "text") return <div key={block.id} className="my-2">{editable(block.id, block.html || block.text.replaceAll("\n", "<br>"), { color: block.color || "#1c1a17", fontFamily: block.fontFamily || FONTS[0][1], fontSize: `${block.fontSize || 16}px`, textAlign: block.align || "left", backgroundColor: block.backgroundColor, padding: block.padding ? `${block.padding}px` : undefined })}</div>;
      if (block.type === "image") return <figure key={block.id} className={`group relative my-3 flex ${block.align === "left" ? "justify-start" : block.align === "right" ? "justify-end" : "justify-center"}`}><img src={block.url} alt={block.alt || "Imagen del correo"} className="block h-auto max-w-full object-contain" style={{ width: `${block.width || 100}%`, borderRadius: `${block.borderRadius || 0}px` }} /><button type="button" onClick={() => { onChange(blocks.filter((item) => item.id !== block.id)); onNotice("Imagen eliminada del correo."); }} className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-lg bg-white text-red-700 shadow ring-1 ring-red-200 opacity-100 sm:opacity-0 sm:group-hover:opacity-100" aria-label="Eliminar imagen"><Trash2 className="h-4 w-4" /></button></figure>;
      if (block.type === "columns") return <div key={block.id} className="my-3 grid items-start" style={{ gap: `${block.gap ?? 12}px`, gridTemplateColumns: (block.widths || block.columns.map(() => 1)).map((width) => `${width}fr`).join(" ") }}>{block.columns.map((column, index) => column.type === "text" ? <div key={index}>{editable(`${block.id}::${index}`, column.html || column.text.replaceAll("\n", "<br>"), { color: column.color || "#1c1a17", fontFamily: column.fontFamily || FONTS[0][1], fontSize: `${column.fontSize || 16}px`, textAlign: column.align || "left" })}</div> : <img key={index} src={column.url} alt={column.alt || "Imagen"} className="block h-auto w-full object-contain" />)}</div>;
      if (block.type === "button") return <div key={block.id} className={`my-3 flex ${block.align === "left" ? "justify-start" : block.align === "right" ? "justify-end" : "justify-center"}`}><span className="inline-flex min-h-10 items-center px-5 text-sm font-semibold" style={{ backgroundColor: block.backgroundColor || "#006b6b", color: block.textColor || "#fff", borderRadius: `${block.borderRadius ?? 8}px` }}>{block.label}</span></div>;
      if (block.type === "divider") return <hr key={block.id} className="my-4 border-0" style={{ height: `${block.thickness || 1}px`, width: `${block.width || 100}%`, backgroundColor: block.color || "#d8dddf" }} />; if (block.type === "spacer") return <div key={block.id} style={{ height: `${block.height}px` }} />; return <div key={block.id} className="my-3 rounded-lg bg-[#f3f4f4] px-3 py-2 text-sm">Archivo adjunto: {block.name}</div>;
    })}</div></div>
  </section>;
}
