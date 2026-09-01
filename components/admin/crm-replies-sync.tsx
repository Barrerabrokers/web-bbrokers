"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RefreshCw } from "lucide-react";

export function CrmRepliesSync({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState("");
  const syncingRef = useRef(false);
  const sync = useCallback(async (manual = false) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const response = await fetch("/api/crm/email/replies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId }) });
      const data = await response.json().catch(() => null) as { imported?: number; available?: boolean; error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "No se pudieron actualizar las respuestas.");
      if (data?.imported) { setStatus(`${data.imported} respuesta${data.imported === 1 ? "" : "s"} actualizada${data.imported === 1 ? "" : "s"}`); router.refresh(); }
      else if (manual) setStatus(data?.available === false ? data.error || "Correo sin conexión de lectura" : "Respuestas al día");
    } catch (error) { if (manual) setStatus(error instanceof Error ? error.message : "No se pudo actualizar"); }
    finally { syncingRef.current = false; setSyncing(false); }
  }, [leadId, router]);

  useEffect(() => {
    void sync(false);
    const timer = window.setInterval(() => void sync(false), 60_000);
    return () => window.clearInterval(timer);
  }, [sync]);

  return <div className="flex flex-wrap items-center justify-end gap-2"><button type="button" onClick={() => void sync(true)} disabled={syncing} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-ink/15 bg-white px-3 text-xs font-medium text-ink transition-colors hover:bg-[#e7f4f2] disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Actualizando" : "Actualizar respuestas"}</button>{status && <span className="inline-flex items-center gap-1 text-xs text-[#006b6b]"><CheckCircle2 className="h-3.5 w-3.5" />{status}</span>}</div>;
}
