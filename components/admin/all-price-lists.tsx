"use client";
import { useState } from "react";
import { ExternalLink, Save, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { SharedPriceList } from "@/lib/all-price-lists";
export function AllPriceLists({initialUrl,canEdit,initialEntries=[]}:{initialUrl:string;canEdit:boolean;initialEntries?:SharedPriceList[]}) {
  const [entries,setEntries]=useState(initialEntries);
  const [adding,setAdding]=useState(false);
  const [newUrl,setNewUrl]=useState("");
  const [description,setDescription]=useState("");
  const [url,setUrl]=useState(initialUrl);
  const [savedUrl,setSavedUrl]=useState(initialUrl);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const router=useRouter();
  async function save(event:React.FormEvent) {
    event.preventDefault();setSaving(true);setMessage("");setError("");
    try {
      const response=await fetch("/api/developments/all-price-lists",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({url})});
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      setSavedUrl(data.url);setUrl(data.url);setMessage("Enlace guardado para todo el equipo.");router.refresh();
    } catch(e) {setError(e instanceof Error?e.message:"No se pudo guardar el enlace.");}
    finally {setSaving(false);}
  }
  async function add(event:React.FormEvent) {
    event.preventDefault();if(saving)return;setSaving(true);setMessage("");setError("");
    try{
      const response=await fetch("/api/developments/all-price-lists",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:newUrl,description})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"No se pudo agregar la lista.");
      setEntries(previous=>[data.entry,...previous]);setNewUrl("");setDescription("");setAdding(false);setMessage("Lista agregada para todo el equipo.");router.refresh();
    }catch(error){setError(error instanceof Error?error.message:"No se pudo agregar la lista.");}
    finally{setSaving(false);}
  }
  return <section className="mb-6 rounded-xl border border-ink/12 bg-white p-5 sm:p-6" aria-label="Todas las listas de precios">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-lg font-semibold text-ink">Todas las listas de precios</h2><p className="mt-1 max-w-2xl text-sm text-ink/70">Enlaces y documentos con los precios de los desarrollos.</p></div>
      <div className="flex flex-wrap gap-2">{canEdit&&<button type="button" onClick={()=>{setAdding(true);setMessage("");setError("");}} aria-expanded={adding} aria-controls="add-price-list-form" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"><Plus className="h-4 w-4"/>Agregar</button>}
      {savedUrl && <a href={savedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-cream-100 px-4 text-sm font-medium text-ink hover:bg-cream-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">Abrir todas las listas<ExternalLink className="h-4 w-4"/></a>}</div>
    </div>
    {canEdit&&adding&&<form id="add-price-list-form" onSubmit={add} className="mt-5 rounded-lg border border-ink/12 bg-cream-50 p-4">
      <h3 className="mb-4 font-semibold text-ink">Agregar lista de precios</h3>
      <label htmlFor="new-price-list-description" className="mb-2 block text-sm font-medium text-ink">Descripción</label>
      <input id="new-price-list-description" required maxLength={500} value={description} onChange={event=>setDescription(event.target.value)} placeholder="Por ejemplo: Feel Recoleta — lista de octubre" className="form-input mb-4 w-full" disabled={saving}/>
      <label htmlFor="new-price-list-url" className="mb-2 block text-sm font-medium text-ink">Enlace</label>
      <input id="new-price-list-url" type="url" required maxLength={4096} value={newUrl} onChange={event=>setNewUrl(event.target.value)} placeholder="https://..." className="form-input w-full" disabled={saving}/>
      <div className="mt-4 flex flex-wrap gap-3"><button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white disabled:opacity-50">{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}{saving?"Guardando…":"Guardar lista"}</button><button type="button" disabled={saving} onClick={()=>{setAdding(false);setError("");}} className="min-h-11 rounded-lg border border-ink/20 px-4 text-sm text-ink">Cancelar</button></div>
    </form>}
    {entries.length>0&&<ul className="mt-5 divide-y divide-ink/10">{entries.map(entry=><li key={entry.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-words font-medium text-ink">{entry.description}</p><p className="mt-1 break-all text-xs text-ink/60">{entry.url}</p></div><a href={entry.url} target="_blank" rel="noopener noreferrer" aria-label={'Abrir lista: '+entry.description} className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-lg border border-ink/15 px-4 text-sm font-medium text-ink">Abrir lista<ExternalLink className="h-4 w-4"/></a></li>)}</ul>}
    {canEdit ? <form onSubmit={save} className="mt-5">
      <label htmlFor="all-price-lists-url" className="mb-2 block text-sm font-medium text-ink">Enlace de Google Drive o Google Sheets</label>
      <div className="flex flex-col gap-3 sm:flex-row"><input id="all-price-lists-url" type="url" value={url} onChange={e=>{setUrl(e.target.value);setMessage("");}} placeholder="https://docs.google.com/spreadsheets/..." className="form-input min-w-0 flex-1" disabled={saving}/><button type="submit" disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cream-100 px-5 text-sm font-medium text-ink hover:bg-cream-200 disabled:opacity-50">{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}{saving?"Guardando…":"Guardar enlace"}</button></div>
      <p className="mt-2 text-xs text-ink/70">Compartí la planilla en Google Drive con los agentes que deban consultarla.</p>
    </form> : !savedUrl && <p className="mt-4 text-sm text-ink/70">Todavía no se agregó la planilla general. Un administrador puede guardar el enlace acá.</p>}
    {message&&<p role="status" className="mt-3 text-sm text-emerald-800">{message}</p>}{error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </section>;
}
