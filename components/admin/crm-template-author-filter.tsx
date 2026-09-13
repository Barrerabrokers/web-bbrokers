"use client";
import type { CrmEmailTemplate } from "@/lib/db";
import { templateAuthors } from "@/lib/crm-template-filters";

export function CrmTemplateAuthorFilter({ templates, value, onChange }: {
  templates: Pick<CrmEmailTemplate, "createdBy" | "createdByName">[]; value: string; onChange: (value: string) => void;
}) {
  return <label className="block text-sm font-medium text-ink">
    Creador de la plantilla
    <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-ink/20 bg-white px-3 text-sm text-ink outline-none focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15">
      <option value="all">Todas las plantillas</option>
      <option value="mine">Mis plantillas</option>
      {templateAuthors(templates).map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
      {templates.some((template) => !template.createdBy) && <option value="unassigned">Sin autor registrado</option>}
    </select>
  </label>;
}
