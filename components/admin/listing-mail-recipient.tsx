"use client";

import { useState, type FormEvent } from "react";
import { CrmEmailComposer, type ListingMailDraft } from "@/components/admin/crm-email-composer";
import { hasValidEmailRecipient } from "@/lib/crm-email-recipient";

type Recipient = { id: string; firstName: string; lastName: string; email: string; phone: string; countryCode: string };

export function ListingMailRecipient({ title, coverUrl, draft, currentAgentId }: { title: string; coverUrl: string; draft: ListingMailDraft; currentAgentId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Recipient[]>([]);
  const [selected, setSelected] = useState<Recipient | null>(null);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  async function search(event: FormEvent) {
    event.preventDefault(); if (busy || query.trim().length < 2) return;
    setBusy(true); setError(""); setResults([]); setSearched(false);
    try {
      const response = await fetch(`/api/crm/leads?query=${encodeURIComponent(query.trim())}&pageSize=30&owner=all`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron buscar los clientes.");
      setResults(data.leads || []); setSearched(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudieron buscar los clientes."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-4xl space-y-6 p-5 md:p-8">
    <header><h1 className="text-2xl font-semibold text-ink">Enviar ficha por correo</h1><p className="mt-2 text-sm text-ink/75">Elegí un cliente y revisá el correo con la portada antes de enviarlo desde tu cuenta de Barrera Brokers.</p></header>
    <section className="flex flex-col gap-4 border-b border-ink/15 pb-6 sm:flex-row sm:items-center">
      <img src={coverUrl} alt={title} className="aspect-[1200/630] w-full rounded-lg object-cover sm:w-56" />
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
    </section>
    <form onSubmit={search} className="space-y-3"><label htmlFor="listing-recipient" className="block text-sm font-semibold text-ink">Buscar cliente por nombre o email</label><div className="flex flex-wrap gap-2"><input id="listing-recipient" value={query} onChange={event => setQuery(event.target.value)} required minLength={2} className="min-h-11 min-w-0 flex-1 rounded-lg border border-ink/25 bg-white px-3 text-sm text-ink" /><button disabled={busy || query.trim().length < 2} className="min-h-11 rounded-lg bg-[#006b6b] px-5 font-semibold text-white disabled:opacity-50">{busy ? "Buscando…" : "Buscar"}</button></div></form>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {searched && !results.length && <p role="status" className="text-sm text-ink/75">No se encontraron clientes. Probá con otro nombre o email.</p>}
    {results.length > 0 && <ul className="divide-y divide-ink/15" aria-label="Clientes encontrados">{results.map(lead => <li key={lead.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium text-ink">{lead.firstName} {lead.lastName}</p><p className="text-sm text-ink/75">{lead.email || "Sin email registrado"}</p></div><button type="button" disabled={!hasValidEmailRecipient(lead.email)} onClick={() => { if (selected?.id === lead.id) window.dispatchEvent(new Event("crm:open-email-composer")); else setSelected(lead); }} className="min-h-11 rounded-lg border border-[#006b6b] px-4 text-sm font-semibold text-[#006b6b] disabled:opacity-50">{hasValidEmailRecipient(lead.email) ? "Redactar correo" : "Email no válido"}</button></li>)}</ul>}
    {selected && <CrmEmailComposer key={selected.id} lead={selected} currentAgentId={currentAgentId} templates={[]} initialDraft={draft} />}
  </main>;
}
