"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { FullSiteSettings } from "@/lib/db";
import { BarChart3, Building2, Mail, MapPin, Save, Info, Upload, X, Loader2, TrendingUp, Newspaper, Palette, Film } from "lucide-react";
import { updateCachedSiteSettings } from "@/lib/use-site-settings";
import { removeAudioFromVideoFile } from "@/lib/video-utils";

export function SettingsForm({ initial }: { initial: FullSiteSettings }) {
  const router = useRouter();
  const [data, setData]      = useState<FullSiteSettings>(initial);
  const [status, setStatus]  = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [aboutVideoUploading, setAboutVideoUploading] = useState(false);
  const [investmentUploading, setInvestmentUploading] = useState(false);
  const [investmentVideoUploading, setInvestmentVideoUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [heroVideoUploading, setHeroVideoUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const aboutVideoFileRef = useRef<HTMLInputElement>(null);
  const aboutVideoCameraRef = useRef<HTMLInputElement>(null);
  const investmentFileRef = useRef<HTMLInputElement>(null);
  const investmentVideoFileRef = useRef<HTMLInputElement>(null);
  const investmentVideoCameraRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const faviconFileRef = useRef<HTMLInputElement>(null);
  const heroVideoFileRef = useRef<HTMLInputElement>(null);
  const heroVideoCameraRef = useRef<HTMLInputElement>(null);

  const update =
    (k: keyof FullSiteSettings) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setData((prev) => ({ ...prev, [k]: e.target.value }));

  const uploadImage = async (
    file: File,
    targetKey: keyof FullSiteSettings,
    setLoading: (b: boolean) => void
  ) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("files", file);
      formData.append("folder", "settings");

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }

      const j = await res.json();
      const url = j.urls?.[0];
      if (!url) throw new Error("No se recibió el archivo subido");
      setData((prev) => ({ ...prev, [targetKey]: url }));
    } catch (err: any) {
      setError(err?.message || "Error al subir imagen");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadImage(file, "aboutImage", setUploading);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleInvestmentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadImage(file, "investmentImage", setInvestmentUploading);
    if (investmentFileRef.current) investmentFileRef.current.value = "";
  };

  const uploadSectionVideo = async (
    e: React.ChangeEvent<HTMLInputElement>,
    targetKey: "aboutVideo" | "investmentVideo",
    setLoading: (value: boolean) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("Seleccioná un archivo de video válido.");
      e.target.value = "";
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("El video es muy grande. Máximo 50MB.");
      e.target.value = "";
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const silentFile = await removeAudioFromVideoFile(file);
      if (silentFile.size > 50 * 1024 * 1024) {
        throw new Error("El video sin audio es muy grande. Máximo 50MB.");
      }

      const formData = new FormData();
      formData.append("files", silentFile);
      formData.append("folder", "settings");

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }

      const j = await res.json();
      const url = j.urls?.[0];
      if (!url) throw new Error("No se recibió el video subido");
      setData((prev) => ({ ...prev, [targetKey]: url }));
    } catch (err: any) {
      setError(err?.message || "Error al subir video");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleBrandAssetUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    targetKey: "logoUrl" | "faviconUrl",
    setLoading: (value: boolean) => void,
    inputRef: React.RefObject<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Seleccioná un archivo de imagen válido.");
      return;
    }
    await uploadImage(file, targetKey, setLoading);
    if (inputRef.current) inputRef.current.value = "";
  };

  const heroVideos = Array.isArray(data.heroVideos)
    ? data.heroVideos.filter(Boolean).slice(0, 3)
    : [];

  const uploadHeroVideos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const availableSlots = Math.max(0, 3 - heroVideos.length);
    const files = selectedFiles.slice(0, availableSlots);

    if (files.length === 0) {
      setError("La portada admite hasta 3 videos.");
      e.target.value = "";
      return;
    }

    for (const file of files) {
      if (!file.type.startsWith("video/")) {
        setError("Seleccioná archivos de video válidos.");
        e.target.value = "";
        return;
      }
    }

    setHeroVideoUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      const silentFiles: File[] = [];
      for (const file of files) {
        const silentFile = await removeAudioFromVideoFile(file);
        if (silentFile.size > 50 * 1024 * 1024) {
          throw new Error(`El video ${file.name} sin audio es muy grande. Máximo 50MB.`);
        }
        silentFiles.push(silentFile);
      }

      silentFiles.forEach((file) => formData.append("files", file));
      formData.append("folder", "settings");

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }

      const j = await res.json();
      const uploadedVideos = (j.urls || []).filter(Boolean).slice(0, availableSlots);
      setData((prev) => ({
        ...prev,
        heroVideos: [...heroVideos, ...uploadedVideos].slice(0, 3),
      }));
    } catch (err: any) {
      setError(err?.message || "Error al subir videos de portada");
    } finally {
      setHeroVideoUploading(false);
      e.target.value = "";
    }
  };

  const removeHeroVideo = (url: string) => {
    setData((prev) => ({
      ...prev,
      heroVideos: heroVideos.filter((candidate) => candidate !== url),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("saving");
    setError(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }

      const saved = await res.json();
      setData(saved);
      updateCachedSiteSettings(saved);
      setStatus("saved");
      router.refresh();
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err: any) {
      setStatus("error");
      setError(err?.message || "Error al guardar");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset className="rounded-xl border border-ink/10 bg-cream-100 p-5 md:p-6">
        <legend className="flex items-center gap-2 px-2 text-[10px] uppercase tracking-[0.2em] text-ink/55">
          <Palette className="h-3.5 w-3.5" />
          Identidad visual
        </legend>

        <p className="mb-5 mt-2 max-w-2xl text-sm leading-relaxed text-ink/65">
          El logo se actualiza en la cabecera, el pie y el acceso al portal. El favicon aparece en la pestaña del navegador y en favoritos.
        </p>

        <div className="grid gap-6 md:grid-cols-2 md:divide-x md:divide-ink/10">
          <BrandAssetField
            label="Logo principal"
            value={data.logoUrl}
            fallback="/logo.png"
            previewClassName="h-24 w-full"
            accept="image/png,image/jpeg,image/webp"
            hint="PNG con fondo transparente recomendado. Máx. 5 MB."
            uploading={logoUploading}
            inputRef={logoFileRef}
            onUpload={(event) => handleBrandAssetUpload(event, "logoUrl", setLogoUploading, logoFileRef)}
            onRemove={() => setData((previous) => ({ ...previous, logoUrl: "/logo.png" }))}
          />
          <div className="md:pl-6">
            <BrandAssetField
              label="Favicon"
              value={data.faviconUrl}
              fallback="/icon.svg"
              previewClassName="h-24 w-24"
              accept="image/png,image/jpeg,image/webp"
              hint="Imagen cuadrada, idealmente PNG de 512 × 512 px. Máx. 5 MB."
              uploading={faviconUploading}
              inputRef={faviconFileRef}
              onUpload={(event) => handleBrandAssetUpload(event, "faviconUrl", setFaviconUploading, faviconFileRef)}
              onRemove={() => setData((previous) => ({ ...previous, faviconUrl: "/icon.svg" }))}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-ink/10 bg-cream-100 p-5 md:p-6">
        <legend className="flex items-center gap-2 px-2 text-[10px] uppercase tracking-[0.2em] text-ink/55">
          <Film className="h-3.5 w-3.5" />
          Videos de portada
        </legend>

        <p className="mb-5 mt-2 max-w-2xl text-sm leading-relaxed text-ink/65">
          Subí hasta 3 archivos de video para la pantalla principal. Se guarda una copia sin audio, se reproduce en silencio y va rotando cuando el visitante entra.
        </p>

        {heroVideos.length > 0 ? (
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            {heroVideos.map((url, index) => (
              <div key={url} className="relative overflow-hidden rounded-lg border border-ink/12 bg-ink/5">
                <video
                  src={url}
                  muted
                  playsInline
                  preload="metadata"
                  className="aspect-video w-full object-cover"
                />
                <span className="absolute bottom-2 left-2 rounded-full bg-ink/75 px-2 py-1 text-[10px] text-white">
                  Portada {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeHeroVideo(url)}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm transition-colors hover:bg-white"
                  aria-label={`Quitar video de portada ${index + 1}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-5 rounded-lg border border-dashed border-ink/20 bg-white/55 p-6 text-center">
            <Film className="mx-auto h-6 w-6 text-ink/45" />
            <p className="mt-3 text-sm font-medium text-ink">Todavía no hay videos cargados.</p>
            <p className="mt-1 text-xs leading-relaxed text-ink/55">
              Usá los botones de abajo para subirlos desde tu computadora o grabarlos desde el celular.
            </p>
          </div>
        )}

        <input
          ref={heroVideoCameraRef}
          type="file"
          accept="video/*"
          capture="environment"
          onChange={uploadHeroVideos}
          className="hidden"
        />
        <input
          ref={heroVideoFileRef}
          type="file"
          accept="video/*"
          multiple
          onChange={uploadHeroVideos}
          className="hidden"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => heroVideoCameraRef.current?.click()}
            disabled={heroVideoUploading || heroVideos.length >= 3}
            className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-ink/20 p-4 text-ink transition-colors hover:border-ink/40 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {heroVideoUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Film className="h-5 w-5" />}
            <span className="text-[10px] font-medium uppercase tracking-[0.18em]">
              Grabar video
            </span>
            <span className="text-xs text-ink/50">Desde celular</span>
          </button>
          <button
            type="button"
            onClick={() => heroVideoFileRef.current?.click()}
            disabled={heroVideoUploading || heroVideos.length >= 3}
            className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-ink/20 p-4 text-ink transition-colors hover:border-ink/40 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {heroVideoUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            <span className="text-[10px] font-medium uppercase tracking-[0.18em]">
              Subir videos
            </span>
            <span className="text-xs text-ink/50">MP4, MOV o WebM. Se suben sin audio.</span>
          </button>
        </div>

        <p className="mt-3 text-xs text-ink/45">
          {heroVideos.length}/3 videos cargados. Si no cargás videos, se usan los videos de Buenos Aires por defecto.
        </p>
      </fieldset>

      {/* ── Empresa ── */}
      <fieldset className="bg-cream-100 border border-ink/10 rounded-xl p-5 md:p-6">
        <legend className="px-2 text-[10px] uppercase tracking-[0.2em] text-ink/50 flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5" />
          Empresa
        </legend>

        <div className="space-y-4 mt-2">
          <Field
            label="Nombre de la empresa"
            value={data.companyName}
            onChange={update("companyName")}
            placeholder="Barrera Brokers"
            required
          />
        </div>
      </fieldset>

      {/* ── Contacto ── */}
      <fieldset className="bg-cream-100 border border-ink/10 rounded-xl p-5 md:p-6">
        <legend className="px-2 text-[10px] uppercase tracking-[0.2em] text-ink/50 flex items-center gap-2">
          <Mail className="h-3.5 w-3.5" />
          Contacto
        </legend>

        <div className="space-y-4 mt-2">
          <Field label="Email de contacto" type="email" value={data.email} onChange={update("email")} placeholder="info@empresa.com" required />
          <Field label="Teléfono (formato visible)" value={data.phone} onChange={update("phone")} placeholder="+54 11 1234-5678" hint="Así se muestra al usuario." required />
          <Field label="WhatsApp (solo números, con código de país)" value={data.whatsapp} onChange={update("whatsapp")} placeholder="541112345678" hint="Sin '+', sin espacios, sin guiones." required />
          <TextareaField label="Mensaje predefinido de WhatsApp" value={data.whatsappMessage} onChange={update("whatsappMessage")} placeholder="Hola! Me interesa…" rows={3} hint="Se pre-completa cuando el cliente toca el botón flotante." />
        </div>
      </fieldset>

      {/* ── Dirección ── */}
      <fieldset className="bg-cream-100 border border-ink/10 rounded-xl p-5 md:p-6">
        <legend className="px-2 text-[10px] uppercase tracking-[0.2em] text-ink/50 flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5" />
          Dirección
        </legend>
        <div className="space-y-4 mt-2">
          <Field label="Calle y número" value={data.addressStreet} onChange={update("addressStreet")} placeholder="Av. Principal 123" />
          <Field label="Ciudad / País" value={data.addressCity} onChange={update("addressCity")} placeholder="Buenos Aires, Argentina" />
        </div>
      </fieldset>

      {/* ── Sección Nosotros ── */}
      <fieldset className="bg-cream-100 border border-ink/10 rounded-xl p-5 md:p-6">
        <legend className="px-2 text-[10px] uppercase tracking-[0.2em] text-ink/50 flex items-center gap-2">
          <Info className="h-3.5 w-3.5" />
          Sección &ldquo;Nosotros&rdquo;
        </legend>

        <div className="space-y-5 mt-2">
          {/* Imagen */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/55 mb-2">
              Imagen o video principal
            </label>

            <div className="flex flex-col sm:flex-row gap-4">
              {(data.aboutVideo || data.aboutImage) && (
                <div className="relative w-full sm:w-48 aspect-[4/5] rounded-lg overflow-hidden border border-ink/10 bg-cream-200 flex-shrink-0">
                  {data.aboutVideo ? (
                    <video
                      src={data.aboutVideo}
                      muted
                      playsInline
                      loop
                      autoPlay
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Image
                      src={data.aboutImage}
                      alt="Imagen Nosotros"
                      fill
                      className="object-cover"
                      sizes="200px"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setData((p) => ({ ...p, aboutImage: "", aboutVideo: "" }))}
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/90 hover:bg-white text-ink flex items-center justify-center shadow-sm transition-all"
                    aria-label="Quitar media"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="flex-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-ink/20 text-sm text-ink hover:bg-cream-200 transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Subiendo…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      {data.aboutImage ? "Cambiar imagen" : "Subir imagen"}
                    </>
                  )}
                </button>
                <p className="text-[11px] text-ink/45 mt-2 leading-relaxed">
                  Formato recomendado: vertical (4:5).<br />
                  Foto: JPG o PNG máx. 5MB. Video: se sube sin audio, máx. 50MB.
                </p>

                <input
                  ref={aboutVideoCameraRef}
                  type="file"
                  accept="video/*"
                  capture="environment"
                  onChange={(event) => uploadSectionVideo(event, "aboutVideo", setAboutVideoUploading)}
                  className="hidden"
                />
                <input
                  ref={aboutVideoFileRef}
                  type="file"
                  accept="video/*"
                  onChange={(event) => uploadSectionVideo(event, "aboutVideo", setAboutVideoUploading)}
                  className="hidden"
                />
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => aboutVideoCameraRef.current?.click()}
                    disabled={aboutVideoUploading}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-ink/20 px-4 py-2 text-xs font-medium text-ink transition-colors hover:bg-cream-200 disabled:opacity-50"
                  >
                    {aboutVideoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Film className="h-3.5 w-3.5" />}
                    Grabar video
                  </button>
                  <button
                    type="button"
                    onClick={() => aboutVideoFileRef.current?.click()}
                    disabled={aboutVideoUploading}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-ink/20 px-4 py-2 text-xs font-medium text-ink transition-colors hover:bg-cream-200 disabled:opacity-50"
                  >
                    {aboutVideoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Subir video
                  </button>
                </div>
                {data.aboutVideo && (
                  <button
                    type="button"
                    onClick={() => setData((p) => ({ ...p, aboutVideo: "" }))}
                    className="mt-3 text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    Quitar video y usar foto
                  </button>
                )}

                <div className="mt-4 pt-4 border-t border-ink/10">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/55 mb-2">
                    O pegá una URL externa
                  </label>
                  <input
                    type="url"
                    value={data.aboutImage}
                    onChange={update("aboutImage")}
                    placeholder="https://…"
                    className="form-input"
                  />
                </div>
                <div className="mt-3">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/55 mb-2">
                    O pegá una URL externa de video
                  </label>
                  <input
                    type="url"
                    value={data.aboutVideo || ""}
                    onChange={update("aboutVideo")}
                    placeholder="https://…mp4"
                    className="form-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Textos */}
          <Field label="Eyebrow (etiqueta superior)" value={data.aboutEyebrow} onChange={update("aboutEyebrow")} placeholder="Nosotros" />
          <Field label="Título" value={data.aboutTitle} onChange={update("aboutTitle")} placeholder="Una inmobiliaria independiente" hint='Para resaltar una palabra en cursiva, escribila igual — la última palabra se muestra en italic.' />
          <TextareaField label="Descripción" value={data.aboutDescription} onChange={update("aboutDescription")} rows={4} placeholder="Nacimos en…" />

          {/* Stat */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Número (stat)" value={data.aboutStatNumber} onChange={update("aboutStatNumber")} placeholder="+500" />
            <div className="sm:col-span-2">
              <Field label="Etiqueta del stat" value={data.aboutStatLabel} onChange={update("aboutStatLabel")} placeholder="Operaciones realizadas" />
            </div>
          </div>

          {/* Valores 1, 2, 3 */}
          <div className="pt-4 mt-4 border-t border-ink/10 space-y-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/45">
              Tres pilares
            </p>

            {[1, 2, 3].map((n) => {
              const titleKey = `aboutValue${n}Title` as keyof FullSiteSettings;
              const descKey  = `aboutValue${n}Description` as keyof FullSiteSettings;
              return (
                <div key={n} className="bg-white/40 rounded-lg p-4 space-y-3 border border-ink/5">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
                    Pilar 0{n}
                  </div>
                  <Field
                    label="Título"
                    value={data[titleKey] as string}
                    onChange={update(titleKey)}
                  />
                  <TextareaField
                    label="Descripción"
                    value={data[descKey] as string}
                    onChange={update(descKey)}
                    rows={2}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </fieldset>

      {/* ── Sección Estadísticas ── */}
      <fieldset className="bg-cream-100 border border-ink/10 rounded-xl p-5 md:p-6">
        <legend className="px-2 text-[10px] uppercase tracking-[0.2em] text-ink/50 flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5" />
          Sección &ldquo;Estadísticas&rdquo;
        </legend>

        <div className="space-y-5 mt-2">
          <Field
            label="Título principal"
            value={data.statsTitle || ""}
            onChange={update("statsTitle")}
            placeholder="Números que respaldan nuestra trayectoria."
          />
          <TextareaField
            label="Frase final"
            value={data.statsQuote || ""}
            onChange={update("statsQuote")}
            rows={2}
            placeholder="Invertir en desarrollos es la forma más inteligente..."
          />

          <div className="pt-4 mt-4 border-t border-ink/10 space-y-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/45">
              Valores visibles en la home
            </p>

            {[1, 2, 3, 4].map((n) => {
              const valueKey = `statsItem${n}Value` as keyof FullSiteSettings;
              const suffixKey = `statsItem${n}Suffix` as keyof FullSiteSettings;
              const labelKey = `statsItem${n}Label` as keyof FullSiteSettings;
              const descKey = `statsItem${n}Description` as keyof FullSiteSettings;
              return (
                <div key={n} className="bg-white/40 rounded-lg p-4 space-y-3 border border-ink/5">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
                    Estadística 0{n}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
                    <Field
                      label="Valor"
                      value={data[valueKey] as string}
                      onChange={update(valueKey)}
                      placeholder={n === 1 ? "25" : n === 2 ? "500" : n === 3 ? "40" : "12"}
                    />
                    <Field
                      label="Sufijo"
                      value={data[suffixKey] as string}
                      onChange={update(suffixKey)}
                      placeholder={n === 3 ? "%" : "+"}
                    />
                  </div>
                  <Field
                    label="Etiqueta"
                    value={data[labelKey] as string}
                    onChange={update(labelKey)}
                    placeholder="Años de experiencia"
                  />
                  <TextareaField
                    label="Descripción"
                    value={data[descKey] as string}
                    onChange={update(descKey)}
                    rows={2}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </fieldset>

      {/* ── Sección Inversión ── */}
      <fieldset className="bg-cream-100 border border-ink/10 rounded-xl p-5 md:p-6">
        <legend className="px-2 text-[10px] uppercase tracking-[0.2em] text-ink/50 flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5" />
          Sección &ldquo;Inversión&rdquo;
        </legend>

        <div className="space-y-5 mt-2">
          {/* Imagen */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/55 mb-2">
              Imagen o video de la sección (opcional)
            </label>

            <div className="flex flex-col sm:flex-row gap-4">
              {(data.investmentVideo || data.investmentImage) && (
                <div className="relative w-full sm:w-48 aspect-video rounded-lg overflow-hidden border border-ink/10 bg-cream-200 flex-shrink-0">
                  {data.investmentVideo ? (
                    <video
                      src={data.investmentVideo}
                      muted
                      playsInline
                      loop
                      autoPlay
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Image
                      src={data.investmentImage}
                      alt="Imagen Inversión"
                      fill
                      className="object-cover"
                      sizes="200px"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setData((p) => ({ ...p, investmentImage: "", investmentVideo: "" }))}
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/90 hover:bg-white text-ink flex items-center justify-center shadow-sm transition-all"
                    aria-label="Quitar media de inversión"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="flex-1">
                <input
                  ref={investmentFileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleInvestmentImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => investmentFileRef.current?.click()}
                  disabled={investmentUploading}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-ink/20 text-sm text-ink hover:bg-cream-200 transition-colors disabled:opacity-50"
                >
                  {investmentUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Subiendo…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      {data.investmentImage ? "Cambiar imagen" : "Subir imagen"}
                    </>
                  )}
                </button>
                <p className="text-[11px] text-ink/45 mt-2 leading-relaxed">
                  Formato recomendado: horizontal (16:9).<br />
                  Foto: JPG o PNG máx. 5MB. Video: se sube sin audio, máx. 50MB.
                </p>

                <input
                  ref={investmentVideoCameraRef}
                  type="file"
                  accept="video/*"
                  capture="environment"
                  onChange={(event) => uploadSectionVideo(event, "investmentVideo", setInvestmentVideoUploading)}
                  className="hidden"
                />
                <input
                  ref={investmentVideoFileRef}
                  type="file"
                  accept="video/*"
                  onChange={(event) => uploadSectionVideo(event, "investmentVideo", setInvestmentVideoUploading)}
                  className="hidden"
                />
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => investmentVideoCameraRef.current?.click()}
                    disabled={investmentVideoUploading}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-ink/20 px-4 py-2 text-xs font-medium text-ink transition-colors hover:bg-cream-200 disabled:opacity-50"
                  >
                    {investmentVideoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Film className="h-3.5 w-3.5" />}
                    Grabar video
                  </button>
                  <button
                    type="button"
                    onClick={() => investmentVideoFileRef.current?.click()}
                    disabled={investmentVideoUploading}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-ink/20 px-4 py-2 text-xs font-medium text-ink transition-colors hover:bg-cream-200 disabled:opacity-50"
                  >
                    {investmentVideoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Subir video
                  </button>
                </div>
                {data.investmentVideo && (
                  <button
                    type="button"
                    onClick={() => setData((p) => ({ ...p, investmentVideo: "" }))}
                    className="mt-3 text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    Quitar video y usar foto
                  </button>
                )}

                <div className="mt-4 pt-4 border-t border-ink/10">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/55 mb-2">
                    O pegá una URL externa
                  </label>
                  <input
                    type="url"
                    value={data.investmentImage}
                    onChange={update("investmentImage")}
                    placeholder="https://…"
                    className="form-input"
                  />
                </div>
                <div className="mt-3">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/55 mb-2">
                    O pegá una URL externa de video
                  </label>
                  <input
                    type="url"
                    value={data.investmentVideo || ""}
                    onChange={update("investmentVideo")}
                    placeholder="https://…mp4"
                    className="form-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Header */}
          <Field label="Eyebrow" value={data.investmentEyebrow} onChange={update("investmentEyebrow")} placeholder="Modelo de inversión" />
          <Field label="Título principal" value={data.investmentTitle} onChange={update("investmentTitle")} placeholder="Cómo funciona la inversión en desarrollos." hint='La palabra "inversión" se muestra en cursiva automáticamente.' />
          <TextareaField label="Descripción" value={data.investmentDescription} onChange={update("investmentDescription")} rows={3} placeholder="Un proceso simple…" />

          {/* 4 Pasos */}
          <div className="pt-4 mt-4 border-t border-ink/10 space-y-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/45">
              4 pasos del proceso
            </p>

            {[1, 2, 3, 4].map((n) => {
              const titleKey     = `investmentStep${n}Title`       as keyof FullSiteSettings;
              const highlightKey = `investmentStep${n}Highlight`   as keyof FullSiteSettings;
              const valueKey     = `investmentStep${n}Value`       as keyof FullSiteSettings;
              const descKey      = `investmentStep${n}Description` as keyof FullSiteSettings;
              return (
                <div key={n} className="bg-white/40 rounded-lg p-4 space-y-3 border border-ink/5">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-ink/40">
                    Paso 0{n}
                  </div>
                  <Field label="Título" value={data[titleKey] as string} onChange={update(titleKey)} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Etiqueta del valor" value={data[highlightKey] as string} onChange={update(highlightKey)} placeholder="Anticipo inicial" />
                    <Field label="Valor destacado" value={data[valueKey] as string} onChange={update(valueKey)} placeholder="35%" />
                  </div>
                  <TextareaField label="Descripción" value={data[descKey] as string} onChange={update(descKey)} rows={3} />
                </div>
              );
            })}
          </div>

          {/* Beneficios */}
          <div className="pt-4 mt-4 border-t border-ink/10 space-y-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/45">
              6 beneficios incluidos
            </p>
            <Field
              label="Título de la lista de beneficios"
              value={data.investmentBenefitsTitle}
              onChange={update("investmentBenefitsTitle")}
              placeholder="Todo lo que incluye invertir con nosotros."
              hint='La palabra "invertir" se muestra en cursiva automáticamente.'
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4, 5, 6].map((n) => {
                const k = `investmentBenefit${n}` as keyof FullSiteSettings;
                return (
                  <Field
                    key={n}
                    label={`Beneficio ${n}`}
                    value={data[k] as string}
                    onChange={update(k)}
                  />
                );
              })}
            </div>
          </div>

          {/* CTA card */}
          <div className="pt-4 mt-4 border-t border-ink/10 space-y-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink/45">
              Card &ldquo;Comenzá ahora&rdquo;
            </p>
            <Field label="Eyebrow del CTA" value={data.investmentCtaEyebrow} onChange={update("investmentCtaEyebrow")} placeholder="Comenzá ahora" />
            <Field label="Título del CTA" value={data.investmentCtaTitle} onChange={update("investmentCtaTitle")} placeholder="¿Querés saber más sobre…?" />
            <TextareaField label="Descripción del CTA" value={data.investmentCtaDescription} onChange={update("investmentCtaDescription")} rows={3} />
          </div>
        </div>
      </fieldset>

      {/* ── Sección Prensa ── */}
      <fieldset className="bg-cream-100 border border-ink/10 rounded-xl p-5 md:p-6">
        <legend className="px-2 text-[10px] uppercase tracking-[0.2em] text-ink/50 flex items-center gap-2">
          <Newspaper className="h-3.5 w-3.5" />
          Sección &ldquo;Prensa&rdquo;
        </legend>

        <div className="space-y-4 mt-2">
          <TextareaField
            label="Links de notas en medios"
            value={data.pressLinks || ""}
            onChange={update("pressLinks")}
            placeholder={"https://medio.com/nota-sobre-barrera-brokers\nhttps://otro-medio.com/inversiones-buenos-aires"}
            rows={6}
            hint="Pegá un link por línea. Si no cargás links, la sección no se muestra en la web."
          />
        </div>
      </fieldset>

      {/* ── Acciones ── */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <div className="text-sm">
          {status === "saved"  && <span className="text-emerald-700">✓ Cambios guardados.</span>}
          {status === "error"  && <span className="text-red-700">{errorMsg}</span>}
          {status === "idle"   && !errorMsg && <span className="text-ink/40">Los cambios se reflejan al instante.</span>}
          {status === "idle"   && errorMsg && <span className="text-red-700">{errorMsg}</span>}
          {status === "saving" && <span className="text-ink/55">Guardando…</span>}
        </div>

        <button
          type="submit"
          disabled={status === "saving" || uploading || aboutVideoUploading || investmentUploading || investmentVideoUploading || logoUploading || faviconUploading || heroVideoUploading}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-ink text-cream-100 text-[11px] uppercase tracking-[0.2em] font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02]"
        >
          <Save className="h-3.5 w-3.5" />
          {status === "saving" ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

/* ── Helpers ── */
function BrandAssetField({
  label,
  value,
  fallback,
  previewClassName,
  accept,
  hint,
  uploading,
  inputRef,
  onUpload,
  onRemove,
}: {
  label: string;
  value: string;
  fallback: string;
  previewClassName: string;
  accept: string;
  hint: string;
  uploading: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  const preview = value || fallback;

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-ink">{label}</p>
      <div className={`relative mb-4 overflow-hidden rounded-lg bg-white ${previewClassName}`}>
        <Image src={preview} alt={`Vista previa de ${label.toLowerCase()}`} fill className="object-contain p-3" sizes="320px" />
        {value !== fallback && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white transition-colors hover:bg-ink/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`Restaurar ${label.toLowerCase()} predeterminado`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} onChange={onUpload} className="hidden" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/20 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/40 hover:bg-cream-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? "Subiendo..." : `Cambiar ${label.toLowerCase()}`}
      </button>
      <p className="mt-2 max-w-xs text-[11px] leading-relaxed text-ink/55">{hint}</p>
    </div>
  );
}

function Field({
  label,
  hint,
  type = "text",
  ...rest
}: {
  label: string;
  hint?: string;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/55 mb-2">
        {label}
      </label>
      <input type={type} className="form-input" {...rest} />
      {hint && <p className="text-[11px] text-ink/45 mt-1.5">{hint}</p>}
    </div>
  );
}

function TextareaField({
  label,
  hint,
  rows = 3,
  ...rest
}: {
  label: string;
  hint?: string;
  rows?: number;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.2em] text-ink/55 mb-2">
        {label}
      </label>
      <textarea rows={rows} className="form-input resize-none" {...rest} />
      {hint && <p className="text-[11px] text-ink/45 mt-1.5">{hint}</p>}
    </div>
  );
}
