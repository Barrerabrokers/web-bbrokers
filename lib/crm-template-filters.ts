import type { CrmEmailTemplate } from "@/lib/db";

export function templateMatchesAuthor(template: Pick<CrmEmailTemplate, "createdBy">, author: string, currentAgentId: string) {
  if (author === "all") return true;
  if (author === "mine") return Boolean(currentAgentId) && template.createdBy === currentAgentId;
  if (author === "unassigned") return !template.createdBy;
  return template.createdBy === author;
}

export function templateAuthors(templates: Pick<CrmEmailTemplate, "createdBy" | "createdByName">[]) {
  const authors = new Map<string, string>();
  for (const template of templates) {
    if (template.createdBy) authors.set(template.createdBy, template.createdByName || "Agente sin nombre");
  }
  return Array.from(authors, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "es"));
}
