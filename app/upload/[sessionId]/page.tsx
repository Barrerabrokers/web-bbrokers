"use client";

import { useState, useRef } from "react";
import { Camera, Image as ImageIcon, Check, Loader2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function MobileUploadPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `mobile-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("properties")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) throw new Error(uploadError.message);

    const { data: urlData } = supabase.storage
      .from("properties")
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const notifyServer = async (fileUrl: string) => {
    const res = await fetch("/api/upload-session", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: params.sessionId, fileUrl }),
    });

    if (res.status === 404 || res.status === 410) {
      setSessionExpired(true);
      throw new Error("Sesion expirada");
    }

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Error al notificar");
    }
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (e.target) e.target.value = "";

    setError("");
    setIsUploading(true);

    try {
      for (const file of files) {
        if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
          continue;
        }
        const url = await uploadFile(file);
        await notifyServer(url);
        setUploaded((prev) => [...prev, url]);
      }
    } catch (err: any) {
      if (!sessionExpired) {
        setError(err.message || "Error al subir");
      }
    } finally {
      setIsUploading(false);
    }
  };

  if (sessionExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#151415] text-[#F1EADE] p-6">
        <div className="text-center max-w-sm">
          <X className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h1 className="text-xl font-light mb-2">Sesion expirada</h1>
          <p className="text-sm opacity-60">
            Genera un nuevo codigo QR desde el panel de administracion.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#151415] text-[#F1EADE] p-6">
      <div className="max-w-sm mx-auto pt-8">
        <h1 className="text-2xl font-light mb-2 text-center">Subir archivos</h1>
        <p className="text-sm opacity-60 text-center mb-8">
          Las fotos y videos aparecen automaticamente en el formulario del admin.
        </p>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Upload buttons */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={isUploading}
            className="flex flex-col items-center justify-center gap-2 p-6 border border-[#F1EADE]/20 rounded-xl hover:border-[#F1EADE]/40 transition-colors disabled:opacity-50"
          >
            <Camera className="h-8 w-8" />
            <span className="text-xs uppercase tracking-widest">Camara</span>
          </button>

          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={isUploading}
            className="flex flex-col items-center justify-center gap-2 p-6 border border-[#F1EADE]/20 rounded-xl hover:border-[#F1EADE]/40 transition-colors disabled:opacity-50"
          >
            <ImageIcon className="h-8 w-8" />
            <span className="text-xs uppercase tracking-widest">Galeria</span>
          </button>
        </div>

        {isUploading && (
          <div className="flex items-center justify-center gap-2 mb-6 text-sm opacity-70">
            <Loader2 className="h-4 w-4 animate-spin" />
            Subiendo...
          </div>
        )}

        {/* Uploaded files */}
        {uploaded.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-widest opacity-50 mb-3">
              {uploaded.length} archivo{uploaded.length !== 1 ? "s" : ""} subido{uploaded.length !== 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {uploaded.map((url, idx) => (
                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-[#F1EADE]/10">
                  {url.match(/\.(mp4|mov|webm)$/i) ? (
                    <video src={url} className="w-full h-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  )}
                  <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hidden inputs */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          multiple
          onChange={handleFiles}
          className="hidden"
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFiles}
          className="hidden"
        />
      </div>
    </div>
  );
}
