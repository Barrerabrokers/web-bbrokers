"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Eye, FileText, Plus, Save, Upload, Link2, Loader2 } from "lucide-react";
import { BlogVideo } from "@/components/blog-video";
import { BlogBody } from "@/components/blog-body";
import { blogArticleContent, blogDate, blogVideo, type BlogInput, type BlogPost } from "@/lib/blog";

const empty: BlogInput = { title: "", excerpt: "", image: "", body: "", status: "draft", featured: true, sourceUrl: "", sourceName: "", gallery: [] };
function input(post: BlogPost): BlogInput { const { title, excerpt, image, body, status, featured, sourceUrl, sourceName, gallery } = post; return { title, excerpt, image, body, status, featured, sourceUrl: sourceUrl || "", sourceName: sourceName || "", gallery: gallery || [] }; }
const statuses = { draft: "Borrador", published: "Publicado", archived: "Archivado" };

export function BlogEditor({ initial }: { initial: BlogPost[] }) {
  const [posts, setPosts] = useState(initial);
  const [selected, setSelected] = useState<BlogPost | null>(null);
  const [draft, setDraft] = useState<BlogInput>({ ...empty });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState("");
  const content = blogArticleContent(draft.body);
  const dirty = JSON.stringify(draft) !== JSON.stringify(selected ? input(selected) : empty);
  const disabled = busy || uploading || importing;
  const change = <K extends keyof BlogInput>(key: K, value: BlogInput[K]) => setDraft(previous => ({ ...previous, [key]: value }));
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function select(post: BlogPost | null) {
    if (dirty) { setNotice("Tenés cambios sin guardar. Guardalos o usá Descartar cambios antes de cambiar de artículo."); return; }
    setSelected(post); setDraft(post ? input(post) : { ...empty }); setPreview(false); setNotice("");
  }
  async function save() {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/admin/blog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, ...(selected ? { id: selected.id, expectedUpdatedAt: selected.updatedAt } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "No se pudo guardar.");
      const post: BlogPost = data.post;
      setPosts(previous => [post, ...previous.filter(item => item.id !== post.id)]);
      setSelected(post); setDraft(input(post));
      setNotice(post.status === "published" ? "Artículo publicado. Ya está disponible en el blog." : post.status === "archived" ? "Artículo archivado. Ya no aparece en el sitio." : "Borrador guardado. Solo el equipo puede verlo.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo guardar. Tu contenido sigue en el editor."); }
    finally { setBusy(false); }
  }
  async function importFromLink() {
    if (dirty) { setNotice("Guardá o descartá los cambios del artículo actual antes de importar otra nota."); return; }
    setImporting(true); setNotice("");
    try {
      const response = await fetch("/api/admin/blog/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: importUrl }) });
      const data = await response.json();
      if (!response.ok || !data.post) throw Error(data.error || "No se pudo importar la nota.");
      const post: BlogPost = data.post;
      setPosts(previous => [post, ...previous.filter(item => item.id !== post.id)]);
      setSelected(post); setDraft(input(post)); setPreview(false); setImportUrl(""); setNotice(data.message);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo importar. Podés completar el artículo manualmente."); }
    finally { setImporting(false); }
  }
  async function upload(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) { setNotice("Elegí una imagen JPG, PNG o WebP de hasta 5 MB."); return; }
    setUploading(true); setNotice("");
    try {
      const form = new FormData(); form.append("files", file); form.append("folder", "settings");
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok || !data.urls?.[0]) throw Error(data.error || "No se pudo subir la imagen.");
      change("image", data.urls[0]); setNotice("Imagen cargada. Guardá el artículo para conservar el cambio.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo subir la imagen."); }
    finally { setUploading(false); }
  }
  async function refresh() {
    if (dirty) { setNotice("Conservá tu texto y descartá los cambios locales antes de recargar la lista."); return; }
    setBusy(true);
    try { const response = await fetch("/api/admin/blog"); const data = await response.json(); if (!response.ok) throw Error(data.error); setPosts(data.posts); const updated = data.posts.find((p: BlogPost) => p.id === selected?.id) || null; setSelected(updated); setDraft(updated ? input(updated) : { ...empty }); setNotice("Lista actualizada."); }
    catch { setNotice("No se pudo actualizar la lista."); }
    finally { setBusy(false); }
  }
  return <div className="blog-editor">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><Link href="/blog" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm text-[#006b6b] hover:underline">Ver blog <ArrowUpRight className="h-4 w-4" /></Link><Link href="/admin/settings" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Administrar enlaces de otros medios</Link></div>
    <form onSubmit={event => { event.preventDefault(); void importFromLink(); }} className="mb-8 rounded-xl border border-ink/20 bg-white p-5 md:p-6" aria-busy={importing}>
      <div className="mb-3 flex items-center gap-2"><Link2 className="h-5 w-5 text-[#006b6b]" aria-hidden="true" /><h2 className="text-base font-medium text-ink">Crear artículo desde un enlace</h2></div>
      <p className="mb-4 max-w-3xl text-sm leading-relaxed text-ink/75">Pegá el link de una nota. Se preparará un borrador con título, bajada, portada, imágenes disponibles y una síntesis original con la fuente enlazada. Podés revisarlo y editarlo antes de publicar.</p>
      <fieldset disabled={disabled} className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="min-w-0 flex-1 text-sm font-medium text-ink">Link del artículo<input type="url" required value={importUrl} maxLength={2048} onChange={event => setImportUrl(event.target.value)} placeholder="https://www.medio.com/una-noticia" className="form-input mt-2 font-normal" /></label><button type="submit" disabled={disabled || !importUrl.trim()} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#006b6b] px-5 text-sm font-medium text-white disabled:opacity-50">{importing ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}{importing ? "Preparando artículo…" : "Crear borrador con IA"}</button></fieldset>
      {importing && <p role="status" className="mt-3 text-sm text-[#006b6b]">Leyendo la nota y preparando el contenido. Puede demorar unos segundos.</p>}
    </form>
    <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-4"><button disabled={disabled} onClick={() => select(null)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#151415] px-4 text-sm font-medium text-white disabled:opacity-50"><Plus className="h-4 w-4" />Nuevo artículo</button>
        <button disabled={disabled} onClick={refresh} className="min-h-11 text-sm text-ink/75 underline underline-offset-4">Actualizar lista</button>
        <div className="divide-y divide-ink/15">{posts.length ? posts.map(post => <button key={post.id} disabled={disabled} onClick={() => select(post)} className={`w-full rounded-lg px-3 py-4 text-left hover:bg-ink/5 ${selected?.id === post.id ? "bg-ink/5" : ""}`} aria-pressed={selected?.id === post.id}><span className={`text-xs ${post.status === "published" ? "text-[#006b6b]" : "text-ink/70"}`}>{statuses[post.status]}</span><span className="mt-2 block text-sm font-medium leading-snug text-ink">{post.title}</span><span className="mt-2 block text-xs text-ink/70">{blogDate(post.publishedAt)}</span></button>) : <p className="py-4 text-sm leading-relaxed text-ink/75">Todavía no hay artículos. Creá el primero y guardalo como borrador o publicalo.</p>}</div>
      </aside>
      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 pb-4"><h2 className="font-display text-2xl text-ink">{selected ? "Editar artículo" : "Nuevo artículo"}</h2><button type="button" disabled={disabled} onClick={() => setPreview(value => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-ink/25 px-4 text-sm text-ink">{preview ? <FileText className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{preview ? "Volver al editor" : "Vista previa"}</button></div>
        <p role="status" aria-live="polite" className="mb-4 whitespace-pre-line text-sm leading-relaxed text-[#006b6b]">{notice}</p>
        {preview ? <article className="rounded-xl border border-ink/15 bg-white p-6 md:p-10"><p className="mb-4 text-xs uppercase tracking-wider text-ink/70">Vista previa · {statuses[draft.status]}</p><h1 className="font-display text-4xl text-ink [overflow-wrap:anywhere]">{draft.title || "Título del artículo"}</h1><p className="my-5 leading-relaxed text-ink/75">{draft.excerpt}</p>{content.videoUrl ? <BlogVideo url={content.videoUrl} title={draft.title} poster={draft.image} featured /> : draft.image.startsWith("https://") && <img src={draft.image} alt={draft.title} className="mb-8 aspect-video w-full rounded-lg object-cover" />}<BlogBody body={content.body || "El contenido aparecerá acá."} />{(draft.gallery || []).filter(src => src.startsWith("https://") && src !== draft.image).length > 0 && <div className="mt-8 grid gap-3 sm:grid-cols-2">{draft.gallery!.filter(src => src.startsWith("https://") && src !== draft.image).map(src => <img key={src} src={src} alt="Imagen adicional del artículo" className="aspect-[4/3] w-full rounded-lg object-cover" />)}</div>}{draft.sourceUrl?.startsWith("https://") && <p className="mt-6 text-sm text-ink/75">Fuente: <a href={draft.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{draft.sourceName || "Artículo original"} ↗</a></p>}</article> : <form onSubmit={event => { event.preventDefault(); void save(); }}>
          <fieldset disabled={disabled} className="space-y-5">
            <label className="block text-sm font-medium text-ink">Título<input required minLength={3} maxLength={200} value={draft.title} onChange={event => change("title", event.target.value)} placeholder="El título que se verá en el carrusel y en el blog" className="form-input mt-2 font-normal" /></label>
            <label className="block text-sm font-medium text-ink">Bajada<textarea maxLength={500} rows={3} value={draft.excerpt} onChange={event => change("excerpt", event.target.value)} placeholder="Un resumen breve que invite a leer" className="form-input mt-2 font-normal" /></label>
            <div><p className="mb-2 text-sm font-medium text-ink">Imagen de portada</p><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-ink/25 px-4 text-sm text-ink focus-within:ring-2 focus-within:ring-ink/60"><Upload className="h-4 w-4" />{uploading ? "Subiendo…" : "Subir imagen"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ""; }} className="sr-only" /></label><p className="mt-2 text-xs text-ink/70">JPG, PNG o WebP de hasta 5 MB. También podés pegar un enlace https.</p><label className="mt-3 block text-sm text-ink">Enlace de la imagen<input type="url" maxLength={2048} value={draft.image} onChange={event => change("image", event.target.value)} className="form-input mt-1" placeholder="https://…" /></label>{draft.image.startsWith("https://") && <img key={draft.image} src={draft.image} alt="Vista previa de portada" className="mt-4 aspect-video w-full max-w-md rounded-lg object-cover" />}</div>
            <label className="block text-sm font-medium text-ink">Otras imágenes<textarea rows={3} value={(draft.gallery || []).join("\n")} onChange={event => change("gallery", event.target.value.split("\n").map(value => value.trim()))} placeholder="Un enlace https por línea (hasta 6 imágenes)" className="form-input mt-2 font-normal" /></label>
            <div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-medium text-ink">Fuente original<input type="url" maxLength={2048} value={draft.sourceUrl || ""} onChange={event => change("sourceUrl", event.target.value)} placeholder="https://www.medio.com/nota" className="form-input mt-2 font-normal" /></label><label className="block text-sm font-medium text-ink">Nombre del medio<input maxLength={120} value={draft.sourceName || ""} onChange={event => change("sourceName", event.target.value)} placeholder="Nombre de la fuente" className="form-input mt-2 font-normal" /></label></div>
            <div><label className="block text-sm font-medium text-ink">Link de video<input type="url" maxLength={2048} value={videoUrl} onChange={event => setVideoUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" className="form-input mt-2 font-normal" /></label><p className="mt-2 text-xs text-ink/75">YouTube, Vimeo o un enlace directo a MP4, WebM u OGG. El primer video abre la nota debajo del título. Los siguientes se muestran dentro del contenido.</p><button type="button" disabled={disabled || !videoUrl.trim()} onClick={() => { const url = videoUrl.trim(); if (!blogVideo(url)) { setNotice("Ingresá un link https válido de YouTube, Vimeo o un archivo MP4, WebM u OGG."); return; } const body = `${draft.body.trimEnd()}\n\n[video](${url})`.trimStart(); if (body.length > 80000) { setNotice("El contenido supera el máximo de 80.000 caracteres."); return; } change("body", body); setVideoUrl(""); setNotice("Video agregado. El primero se destaca al inicio de la nota. Podés verlo en Vista previa y guardar el artículo."); }} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-ink/25 px-4 text-sm text-ink disabled:opacity-50"><Plus className="h-4 w-4" />Agregar video al contenido</button></div>
            <label className="block text-sm font-medium text-ink">Contenido<textarea rows={16} maxLength={80000} value={draft.body} onChange={event => change("body", event.target.value)} placeholder="Escribí tu artículo…" className="form-input mt-2 font-normal leading-relaxed" /></label>
            <p className="text-xs leading-relaxed text-ink/75">Separá los párrafos con una línea en blanco. Usá ## antes de un subtítulo, - para una lista y [texto](/desarrollos) para un enlace. Los links pegados se abren con un clic. Para mostrar un video, agregalo con el campo de arriba o pegá su URL en un párrafo separado.</p>
            <div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-medium text-ink">Estado<select value={draft.status} onChange={event => change("status", event.target.value as BlogInput["status"])} className="form-input mt-2"><option value="draft">Borrador · solo el equipo</option><option value="published">Publicado · visible en la web</option><option value="archived">Archivado · oculto en la web</option></select></label><label className="flex min-h-11 items-center gap-3 text-sm text-ink"><input type="checkbox" checked={draft.featured} onChange={event => change("featured", event.target.checked)} />Mostrar en el carrusel del inicio</label></div>
            <div className="flex flex-wrap items-center gap-4 border-t border-ink/15 pt-5"><button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#151415] px-5 text-sm font-medium text-white disabled:opacity-50"><Save className="h-4 w-4" />{busy ? "Guardando…" : draft.status === "published" ? "Guardar y publicar" : "Guardar cambios"}</button>{dirty && <button type="button" onClick={() => { setDraft(selected ? input(selected) : { ...empty }); setNotice("Cambios locales descartados."); }} className="min-h-11 text-sm text-ink underline underline-offset-4">Descartar cambios</button>}{selected?.status === "published" && <Link href={`/blog/${selected.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm text-[#006b6b]">Ver publicado <ArrowUpRight className="h-4 w-4" /></Link>}</div>
          </fieldset>
        </form>}
        {preview && <p className="mt-4 text-sm text-ink/75">Volvé al editor para guardar. La vista previa no publica el artículo.</p>}
      </div>
    </div>
  </div>;
}
