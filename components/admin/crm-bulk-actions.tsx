"use client";
import { useState } from "react";

export function CrmBulkActions({ ids, agents, statuses, canUnassign, onClear, onUpdated }: {
  ids: string[]; agents: { id: string; name: string; email: string }[];
  statuses: { value: string; label: string }[]; canUnassign: boolean;
  onClear: () => void; onUpdated: () => Promise<void>;
}) {
  const [action, setAction] = useState("status");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function apply() {
    if (!value || !ids.length || busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/crm/leads/bulk", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, ...(action === "status" ? { status: value } : { assignedAgentId: value === "unassigned" ? "" : value }) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron guardar los cambios.");
      onClear(); setValue("");
      setMessage(`${data.updated} contactos actualizados.${data.automationWarning ? " Revisá las automatizaciones: alguna no pudo ejecutarse." : ""}`);
      try { await onUpdated(); } catch { setMessage(`${data.updated} contactos actualizados. Recargá la página para ver la lista actualizada.`); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudieron guardar los cambios."); }
    finally { setBusy(false); }
  }
  if (!ids.length && !message) return null;
  return <section aria-label="Acciones para contactos seleccionados" className="border-b border-ink/15 bg-[#edf6f4] p-4">
    {ids.length > 0 && <div className="flex flex-wrap items-end gap-3">
      <strong className="self-center text-sm text-[#005c5c]">{ids.length} seleccionados</strong>
      <label className="grid min-w-0 flex-1 gap-1 text-sm sm:flex-none">Acción
        <select disabled={busy} value={action} onChange={e => { setAction(e.target.value); setValue(""); setMessage(""); }} className="form-input min-h-11">
          <option value="status">Cambiar estado</option><option value="owner">Cambiar propietario</option>
        </select>
      </label>
      <label className="grid min-w-0 flex-1 gap-1 text-sm">{action === "status" ? "Nuevo estado" : "Nuevo propietario"}
        <select disabled={busy} value={value} onChange={e => setValue(e.target.value)} className="form-input min-h-11">
          <option value="">Seleccionar…</option>
          {action === "status" ? statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>) : <>
            {canUnassign && <option value="unassigned">Sin asignar</option>}
            {agents.map(a => <option key={a.id} value={a.id}>{a.name || a.email}</option>)}
          </>}
        </select>
      </label>
      <button type="button" disabled={busy || !value} onClick={() => void apply()} className="min-h-11 rounded-lg bg-[#005c5c] px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Guardando…" : `Aplicar a ${ids.length}`}</button>
      <button type="button" disabled={busy} onClick={onClear} className="min-h-11 px-3 text-sm underline">Cancelar selección</button>
      {action === "owner" && !canUnassign && <p className="w-full text-sm text-ink/70">Al transferirlos, dejarás de ver estos contactos y pasarán al agente elegido.</p>}
    </div>}
    {message && <p role="status" className="mt-2 text-sm text-ink">{message}</p>}
  </section>;
}
