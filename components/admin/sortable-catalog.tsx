"use client";

import { Children, useState, type ReactNode } from "react";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, sortableKeyboardCoordinates, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUp, ArrowDown, GripVertical } from "lucide-react";

type Item = { id: string; label: string };
const button = "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-ink/20 bg-white px-3 text-sm font-medium text-ink hover:bg-cream-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b] disabled:opacity-40";

export function SortableCatalog({ kind, items, children, canEdit, className }: { kind: "properties" | "developments"; items: Item[]; children: ReactNode; canEdit: boolean; className: string }) {
  const [ids, setIds] = useState(items.map(item => item.id));
  const [version, setVersion] = useState(ids);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const nodes = Children.toArray(children);
  const byId = new Map(items.map((item, index) => [item.id, { ...item, node: nodes[index] }]));
  const dirty = ids.some((id, index) => id !== version[index]);
  const move = (from: number, to: number) => { setIds(current => arrayMove(current, from, to)); setNotice(""); setError(""); };
  const dragEnd = ({ active, over }: DragEndEvent) => {
    if (busy || !over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id)), to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) move(from, to);
  };
  async function save() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/catalog/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, version, ids }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo guardar el orden.");
      setVersion([...ids]); setEditing(false); setNotice("Orden guardado. El sitio muestra primero las fichas de más arriba.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar el orden."); }
    finally { setBusy(false); }
  }
  return <div>
    {canEdit && items.length > 1 && <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-ink/10 bg-cream-100 p-4">
      <p className="flex-1 text-sm text-ink/70">El orden de estas fichas define cómo aparecen en el sitio. Las de arriba se muestran primero.</p>
      {editing ? <><button type="button" disabled={busy || !dirty} onClick={() => void save()} className={button}>{busy ? "Guardando…" : "Guardar orden"}</button><button type="button" disabled={busy} onClick={() => { setIds([...version]); setEditing(false); setError(""); }} className={button}>Cancelar</button></> : <button type="button" onClick={() => { setEditing(true); setNotice(""); }} className={button}>Ordenar catálogo</button>}
    </div>}
    {editing && <p className="mb-4 text-sm text-ink/65">Arrastrá desde el asa o usá Subir y Bajar. Guardá el orden al terminar.</p>}
    {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mb-4 text-sm text-[#006b6b]">{notice}</p>}
    <DndContext id={`catalog-${kind}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={className}>{ids.map((id, index) => {
          const item = byId.get(id);
          return item ? <SortableRow key={id} id={id} label={item.label} position={index} count={ids.length} editing={editing} busy={busy} onMove={to => move(index, to)}>{item.node}</SortableRow> : null;
        })}</div>
      </SortableContext>
    </DndContext>
  </div>;
}

function SortableRow({ id, label, position, count, editing, busy, onMove, children }: { id: string; label: string; position: number; count: number; editing: boolean; busy: boolean; onMove: (to: number) => void; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !editing || busy });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, position: "relative", zIndex: isDragging ? 10 : undefined, opacity: isDragging ? 0.7 : 1 }}>
    {editing && <div className="mb-2 flex items-center gap-2 rounded-lg border border-ink/15 bg-white px-2 py-1">
      <button type="button" {...attributes} {...listeners} disabled={busy} aria-label={`Arrastrar ${label}`} className={`${button} touch-none px-2`}><GripVertical className="h-4 w-4" /></button>
      <span className="flex-1 text-xs font-medium tabular-nums text-ink/65">Posición {position + 1}</span>
      <button type="button" disabled={busy || position === 0} onClick={() => onMove(position - 1)} aria-label={`Subir ${label}`} title="Subir" className={`${button} px-2`}><ArrowUp className="h-4 w-4" /></button>
      <button type="button" disabled={busy || position === count - 1} onClick={() => onMove(position + 1)} aria-label={`Bajar ${label}`} title="Bajar" className={`${button} px-2`}><ArrowDown className="h-4 w-4" /></button>
    </div>}
    {children}
  </div>;
}
