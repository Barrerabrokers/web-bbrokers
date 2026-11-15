"use client";

import { useState, type FormEvent } from "react";
import { argentinaLocalDateTimeToIso } from "@/lib/argentina-time";
import { useRouter } from "next/navigation";
import { readPurchaseHistory, purchaseSchema, type Purchase, type PurchaseChange, type PurchaseHistoryData } from "@/lib/crm-purchases";

const money = (amount: number | null) => amount === null ? "No informado" : `USD ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(amount)}`;
const displayDate = (date: string | null) => date ? date.split("-").reverse().join("/") : "No informada";
const grouped = (purchase: Purchase) => purchase.collective || purchase.units.length > 1;
const fieldClass = "mt-1 h-10 w-full rounded-lg border border-ink/20 bg-white px-3 text-sm text-ink outline-none focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15";
const buttonClass = "min-h-10 rounded-lg px-3 text-sm font-medium text-[#006b6b] hover:bg-[#e7f4f2] disabled:opacity-50";
type Draft = { type: Purchase["type"]; development: string; units: string[]; date: string; price: string; advance: string; balance: string; collective?: boolean; signingDate: string; signingTime: string };
const emptyDraft = (): Draft => ({ type: "VENTA", development: "", units: [""], date: "", price: "", advance: "", balance: "", signingDate: "", signingTime: "" });

export function CrmPurchaseHistory({ leadId, value, canEdit, developmentNames = [] }: { leadId: string; value: unknown; canEdit: boolean; developmentNames?: string[] }) {
  const router = useRouter();
  const [version, setVersion] = useState<string | null>(typeof value === "string" ? value : null);
  const [editor, setEditor] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [balanceEdited, setBalanceEdited] = useState(false);
  const [deleting, setDeleting] = useState<{ index: number; unitIndex: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  let history: PurchaseHistoryData;
  try { history = readPurchaseHistory(version); } catch {
    return <section id="purchase-information" className="rounded-xl bg-white p-5 ring-1 ring-ink/10"><h2 className="text-lg font-semibold">Información detallada de compras y reservas</h2><p role="alert" className="mt-3 text-sm text-red-700">No se pudo leer el historial de compras. Contactá al administrador para revisarlo.</p></section>;
  }
  const start = (index: number | "new", type: Purchase["type"] = "VENTA", convert = false) => {
    const purchase = index === "new" ? null : history.operations[index];
    const signing = purchase?.signingAt ? new Date(new Date(purchase.signingAt).getTime() - 3 * 60 * 60 * 1000).toISOString() : "";
    setDraft(purchase ? { ...purchase, type: convert ? "VENTA" : purchase.type, signingDate: signing.slice(0, 10), signingTime: signing.slice(11, 16), units: [...purchase.units], date: purchase.date || "", price: purchase.price === null ? "" : String(purchase.price), advance: purchase.advance === null ? "" : String(purchase.advance), balance: purchase.balance === null ? "" : String(purchase.balance) } : { ...emptyDraft(), type });
    setBalanceEdited(Boolean(purchase)); setEditor(index); setDeleting(null); setError(""); setNotice("");
  };
  const setAmount = (name: "price" | "advance" | "balance", value: string) => {
    if (name === "balance") setBalanceEdited(true);
    setDraft(current => {
      const next = { ...current, [name]: value };
      if (name !== "balance" && !balanceEdited && next.price !== "" && next.advance !== "") next.balance = String(Math.round((Number(next.price) - Number(next.advance)) * 100) / 100);
      else if (name !== "balance" && !balanceEdited) next.balance = "";
      return next;
    });
  };
  const save = async (change: PurchaseChange) => {
    if (!canEdit || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/crm/purchases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId, version, change }) });
      const result = await response.json().catch(() => null);
      if (!response.ok || typeof result?.version !== "string") throw new Error(result?.error || "No se pudo confirmar el guardado. Actualizá la ficha antes de reintentar.");
      setVersion(result.version); setEditor(null); setDeleting(null); setNotice(result.warning || (change.action === "delete" ? "Unidad eliminada." : change.purchase.type === "RESERVA" ? (change.purchase.signingAt ? "Reserva guardada. Firma agregada a la agenda del CRM; Google Calendar se sincroniza con las cuentas conectadas." : "Reserva guardada. Podés agregar la firma cuando confirmes el horario.") : "Compra guardada.")); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (draft.type === "RESERVA" && !draft.date) { setError("Completá la fecha en que se tomó la reserva."); return; }
    if (Boolean(draft.signingDate) !== Boolean(draft.signingTime)) { setError("Completá la fecha y la hora de firma."); return; }
    if (draft.signingDate && draft.date && draft.signingDate < draft.date) { setError("La firma no puede ser anterior a la fecha de la operación."); return; }
    const parsed = purchaseSchema.safeParse({ ...draft, signingAt: draft.signingDate && draft.signingTime ? argentinaLocalDateTimeToIso(draft.signingDate, draft.signingTime) : null, collective: draft.collective || draft.units.length > 1, date: draft.date || null, price: draft.price === "" ? null : Number(draft.price), advance: draft.advance === "" ? null : Number(draft.advance), balance: draft.balance === "" ? null : Number(draft.balance) });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || "Revisá los datos."); return; }
    if (editor !== null) void save(editor === "new" ? { action: "add", purchase: parsed.data } : { action: "edit", index: editor, purchase: parsed.data });
  };
  return <section id="purchase-information" aria-labelledby="purchase-information-title" className="scroll-mt-20 rounded-xl bg-white p-5 ring-1 ring-ink/10 lg:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="purchase-information-title" className="text-lg font-semibold tracking-tight text-ink">Información detallada de compras y reservas</h2>
      {canEdit && editor === null && <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => start("new", "RESERVA")} className={buttonClass}>Agregar reserva</button><button type="button" disabled={busy} onClick={() => start("new")} className={buttonClass}>Agregar unidad</button></div>}
    </div>
    {Array.isArray(history.imported_contacts) && history.imported_contacts.length > 0 && <details className="mt-4 rounded-lg border border-ink/10 p-3 text-sm"><summary className="cursor-pointer font-medium text-[#006b6b]">Titulares y datos del Excel</summary><div className="mt-3 space-y-3">{history.imported_contacts.map((raw, index) => { const contact = raw as Record<string, unknown>; return <dl key={index} className="grid gap-1 break-words">{[["Titular(es)", contact.name], ["DNI / documento", contact.dni], ["Dirección", contact.address], ["Teléfono(s)", contact.phone], ["Correo(s)", contact.email]].filter(([, value]) => value !== null && value !== undefined && value !== "").map(([label, value]) => <div key={String(label)}><dt className="inline font-medium">{String(label)}: </dt><dd className="inline">{String(value)}</dd></div>)}</dl>; })}</div><p className="mt-3 text-xs text-ink/65">Datos originales conservados como referencia. Los campos editables de la ficha tienen prioridad.</p></details>}
    {!history.operations.length && <p className="mt-4 text-sm text-ink/70">Todavía no hay compras ni reservas registradas.</p>}
    {history.operations.length > 0 && <div className="mt-5 overflow-x-auto" tabIndex={0} role="region" aria-label="Detalle de unidades compradas"><table className="w-full text-left text-sm text-ink">
      <caption className="sr-only">Una fila por unidad; importes en dólares estadounidenses</caption>
      <thead><tr className="border-b border-ink/15 text-xs text-ink/65">{["Fecha", "Desarrollo", "UF", "Firma (Argentina)", "Valor total", "Anticipo", "Saldo", ...(canEdit ? ["Acciones"] : [])].map((label, index) => <th scope="col" key={label} className={`whitespace-nowrap px-3 py-3 font-medium first:pl-0 last:pr-0 ${index > 3 && index < 7 ? "text-right" : ""}`}>{label}</th>)}</tr></thead>
      <tbody>{history.operations.flatMap((purchase, index) => purchase.units.map((unit, unitIndex) => <tr key={`${index}-${unitIndex}`} className="border-b border-ink/10">
        <td className="whitespace-nowrap py-4 pr-3 tabular-nums">{displayDate(purchase.date)}{purchase.type === "RESERVA" && <span className="ml-2 text-xs text-[#006b6b]">Reserva</span>}</td>
        <td className="whitespace-nowrap px-3 py-4">{purchase.development}</td><td className="whitespace-nowrap px-3 py-4 font-medium">{unit}</td>
        <td className="whitespace-nowrap px-3 py-4 tabular-nums">{purchase.signingAt ? new Date(purchase.signingAt).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short", hourCycle: "h23" }) : "Sin programar"}{purchase.reservationDate && <span className="block text-xs text-ink/65">Reserva: {displayDate(purchase.reservationDate)}</span>}</td>
        <td className="whitespace-nowrap px-3 py-4 text-right tabular-nums">{grouped(purchase) ? "Sin desglose" : money(purchase.price)}</td>
        <td className="whitespace-nowrap px-3 py-4 text-right tabular-nums">{grouped(purchase) ? "Conjunto" : money(purchase.advance)}</td>
        <td className="whitespace-nowrap px-3 py-4 text-right tabular-nums">{grouped(purchase) ? "Conjunto" : money(purchase.balance)}</td>
        {canEdit && <td className="whitespace-nowrap py-2 pl-2"><button type="button" disabled={busy || editor !== null} onClick={() => start(index)} aria-label={`Editar compra de ${purchase.development}, UF ${unit}`} className={buttonClass}>Editar</button>{purchase.type === "RESERVA" && unitIndex === 0 && <button type="button" disabled={busy || editor !== null} onClick={() => start(index, "VENTA", true)} className={buttonClass}>Convertir en compra</button>}<button type="button" disabled={busy || editor !== null} onClick={() => { setDeleting({ index, unitIndex }); setError(""); setNotice(""); }} aria-label={`Borrar unidad ${unit} de ${purchase.development}`} className="min-h-10 rounded-lg px-3 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">Borrar</button></td>}
      </tr>))}</tbody>
    </table></div>}
    {history.operations.filter(grouped).map((purchase, index) => <div key={index} className="mt-5 border-t border-ink/15 pt-4">
      <p className="text-sm font-semibold text-ink">Importes conjuntos · {purchase.development} · UF {purchase.units.join(", ")}</p>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-3 text-sm">{[["Valor total", purchase.price], ["Anticipo", purchase.advance], ["Saldo", purchase.balance]].map(([label, value]) => <div key={label}><dt className="text-xs text-ink/65">{label}</dt><dd className="mt-1 tabular-nums">{money(typeof value === "number" ? value : null)}</dd></div>)}</dl>
      <p className="mt-2 text-xs text-ink/65">Los importes corresponden a la compra conjunta; no hay desglose por unidad.</p>
    </div>)}
    {canEdit && deleting && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4" role="group" aria-label="Confirmar eliminación de unidad">
      <p className="text-sm text-ink">¿Borrar UF {history.operations[deleting.index]?.units[deleting.unitIndex]} de {history.operations[deleting.index]?.development}?</p>
      {grouped(history.operations[deleting.index]) && history.operations[deleting.index].units.length > 1 && <p className="mt-2 text-sm text-ink/75">Los importes conjuntos se conservarán. Podés editarlos si corresponde ajustarlos.</p>}
      <div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={() => void save({ action: "delete", ...deleting })} className="min-h-10 rounded-lg bg-red-700 px-3 text-sm font-medium text-white disabled:opacity-50">{busy ? "Borrando…" : "Confirmar borrado"}</button><button type="button" disabled={busy} onClick={() => setDeleting(null)} className={buttonClass}>Cancelar</button></div>
    </div>}
    {canEdit && editor !== null && <form onSubmit={submit} className="mt-5 border-t border-ink/15 pt-5">
      <h3 className="font-semibold text-ink">{draft.type === "RESERVA" ? (editor === "new" ? "Nueva reserva" : "Editar reserva") : (editor === "new" ? "Nueva compra" : "Editar compra")}</h3>
      {(draft.collective || draft.units.length > 1) && <p className="mt-2 text-sm text-ink/75">Estás editando una operación conjunta. La fecha, el desarrollo y los importes se aplican al conjunto de unidades.</p>}
      <fieldset disabled={busy} className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">{draft.type === "RESERVA" ? "Fecha de la reserva" : "Fecha de compra"}<input required={draft.type === "RESERVA"} type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} className={fieldClass}/></label>
        <label className="text-sm font-medium">Tipo<select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as Draft["type"] })} className={fieldClass}><option value="VENTA">Venta</option><option value="RESERVA">Reserva</option><option value="REVENTA">Reventa</option><option value="USADO">Usado</option></select></label>
        {(draft.type === "RESERVA" || draft.signingDate || draft.signingTime) && <><label className="text-sm font-medium">Fecha de firma<input type="date" min={draft.date || undefined} value={draft.signingDate} onChange={e => setDraft({ ...draft, signingDate: e.target.value })} className={fieldClass}/></label><label className="text-sm font-medium">Hora de firma (Argentina)<input type="time" value={draft.signingTime} onChange={e => setDraft({ ...draft, signingTime: e.target.value })} className={fieldClass}/></label><p className="text-xs leading-relaxed text-ink/65 sm:col-span-2">La firma se agrega a la agenda del agente asignado y de todos los administradores. Si aún no está confirmada, podés dejar fecha y hora vacías. Se sincroniza también con sus cuentas de Google Calendar conectadas.</p></>}
        <label className="text-sm font-medium sm:col-span-2">Desarrollo<input required maxLength={200} list={`purchase-developments-${leadId}`} value={draft.development} onChange={e => setDraft({ ...draft, development: e.target.value })} className={fieldClass}/></label>
        <datalist id={`purchase-developments-${leadId}`}>{developmentNames.map(name => <option value={name} key={name}/>)}</datalist>
        <div className="sm:col-span-2"><div className="flex flex-wrap gap-3">{draft.units.map((unit, index) => <label key={index} className="min-w-0 flex-1 text-sm font-medium">UF {draft.units.length > 1 ? index + 1 : ""}<div className="flex items-center gap-1"><input required maxLength={60} value={unit} onChange={e => setDraft({ ...draft, units: draft.units.map((value, i) => i === index ? e.target.value : value) })} className={fieldClass}/>{draft.units.length > 1 && <button type="button" onClick={() => setDraft({ ...draft, units: draft.units.filter((_, i) => i !== index) })} aria-label={`Quitar UF ${index + 1} del formulario`} className="mt-1 min-h-10 px-2 text-red-700">Quitar</button>}</div></label>)}</div><button type="button" disabled={draft.units.length >= 100} onClick={() => setDraft({ ...draft, units: [...draft.units, ""], collective: true })} className={`mt-2 ${buttonClass}`}>Agregar UF a esta {draft.type === "RESERVA" ? "reserva" : "compra"} conjunta</button></div>
        {([['price', 'Valor total (USD)'], ['advance', 'Anticipo (USD)'], ['balance', 'Saldo (USD)']] as const).map(([key, label]) => <label key={key} className="text-sm font-medium">{label}<input type="number" min="0" max="999999999999" step="0.01" value={draft[key]} onChange={e => setAmount(key, e.target.value)} className={fieldClass}/></label>)}
        <p className="self-end text-xs leading-relaxed text-ink/65">Los campos vacíos quedan como no informados. En una compra nueva se sugiere valor total menos anticipo. Podés editar el saldo para registrar el importe confirmado.</p>
        <div className="flex flex-wrap gap-2 sm:col-span-2"><button type="submit" className="min-h-11 rounded-lg bg-[#006b6b] px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Guardando…" : draft.type === "RESERVA" ? "Guardar reserva" : "Guardar compra"}</button><button type="button" onClick={() => { setEditor(null); setError(""); }} className={buttonClass}>Cancelar</button></div>
      </fieldset>
    </form>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="mt-4 text-sm text-[#006b6b]">{notice}</p>}
    <p className="mt-4 border-t border-ink/10 pt-4 text-xs leading-relaxed text-ink/65">Importes en USD. El saldo importado corresponde al valor menos el anticipo; los pagos posteriores deben actualizarse manualmente.</p>
  </section>;
}
