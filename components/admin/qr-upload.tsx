"use client";

import { useCallback, useEffect, useState } from "react";
import { QrCode, RefreshCw, Smartphone, Check } from "lucide-react";
import QRCode from "qrcode";

interface QrUploadProps {
  onFilesReceived: (urls: string[]) => void;
}

export function QrUpload({ onFilesReceived }: QrUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const createSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/upload-session", { method: "POST" });
      if (!res.ok) throw new Error("Error creando sesion");
      const data = await res.json();
      setSessionId(data.sessionId);
      setUploadUrl(data.uploadUrl);
      setFileCount(0);

      const qr = await QRCode.toDataURL(data.uploadUrl, {
        width: 280,
        margin: 2,
        color: { dark: "#151415", light: "#F1EADE" },
      });
      setQrDataUrl(qr);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Poll for new files every 3 seconds
  useEffect(() => {
    if (!sessionId || !isOpen) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/upload-session?sessionId=${sessionId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.files && data.files.length > fileCount) {
          const newFiles = data.files.slice(fileCount);
          setFileCount(data.files.length);
          onFilesReceived(newFiles);
        }
      } catch {}
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionId, isOpen, fileCount, onFilesReceived]);

  const handleOpen = async () => {
    setIsOpen(true);
    await createSession();
  };

  const handleClose = () => {
    setIsOpen(false);
    setSessionId(null);
    setQrDataUrl(null);
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-2 px-4 py-2.5 border border-ink/20 rounded-lg hover:border-ink/40 hover:bg-ink/5 transition-colors text-sm"
      >
        <Smartphone className="h-4 w-4" />
        <span>Subir desde celular (QR)</span>
      </button>
    );
  }

  return (
    <div className="border border-ink/20 rounded-lg p-5 bg-bone-50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <QrCode className="h-4 w-4 text-ink/70" />
          <span className="label-tracking text-ink/85">Subir desde celular</span>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="text-xs text-ink/50 hover:text-ink"
        >
          Cerrar
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-5 w-5 animate-spin text-ink/50" />
        </div>
      ) : qrDataUrl ? (
        <div className="flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="QR para subir desde celular"
            className="w-[200px] h-[200px] rounded-lg border border-ink/10"
          />
          <p className="text-xs text-ink/60 mt-3 text-center max-w-[240px]">
            Escanealo con la camara del celular. Las fotos que subas aparecen aca automaticamente.
          </p>
          {fileCount > 0 && (
            <div className="flex items-center gap-1.5 mt-3 text-sm text-green-700 bg-green-500/10 px-3 py-1.5 rounded-full">
              <Check className="h-3.5 w-3.5" />
              {fileCount} archivo{fileCount !== 1 ? "s" : ""} recibido{fileCount !== 1 ? "s" : ""}
            </div>
          )}
          <button
            type="button"
            onClick={createSession}
            className="mt-3 text-xs text-ink/50 hover:text-ink flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Generar nuevo QR
          </button>
        </div>
      ) : null}
    </div>
  );
}
