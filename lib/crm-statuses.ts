export const CRM_LEAD_STATUS_OPTIONS = [
  { value: "Nuevo", label: "Nuevo" },
  { value: "Intento de contacto", label: "Intento de contacto" },
  { value: "Contactado", label: "Contactado" },
  { value: "No contesta", label: "No contesta" },
  { value: "Interesado", label: "Interesado" },
  // The database value remains unaccented because the calendar trigger uses it.
  { value: "Reunion", label: "Reunión" },
  { value: "En curso", label: "En curso" },
  { value: "Reservado", label: "Reservado" },
  { value: "No interesado / no califica", label: "No interesado / no califica" },
  { value: "Reflote", label: "Reflote" },
  { value: "Vendido", label: "Vendido" },
] as const;

// Kept for existing imports; every external value is normalized into this CRM funnel.
export const HUBSPOT_LEAD_STATUS_OPTIONS = CRM_LEAD_STATUS_OPTIONS;
export type CrmLeadStatus = typeof CRM_LEAD_STATUS_OPTIONS[number]["value"];
export const CRM_LEAD_STATUS_VALUES = CRM_LEAD_STATUS_OPTIONS.map((option) => option.value);

function normalize(value?: string | null) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

const STATUS_ALIASES: Record<string, CrmLeadStatus> = {
  nuevo: "Nuevo", new: "Nuevo", open: "Nuevo",
  "intento de contacto": "Intento de contacto", attempted_to_contact: "Intento de contacto", "attempted to contact": "Intento de contacto",
  contactado: "Contactado", contacted: "Contactado", connected: "Contactado",
  calificado: "Interesado", interesado: "Interesado", qualified: "Interesado",
  reunion: "Reunion", visita: "Reunion",
  "en negociacion": "En curso", "en curso": "En curso", in_progress: "En curso", open_deal: "En curso", propuesta: "En curso",
  reservado: "Reservado",
  "no interesado / no califica": "No interesado / no califica", "no interesado": "No interesado / no califica", unqualified: "No interesado / no califica", "no calificado": "No interesado / no califica", "no existe": "No interesado / no califica", "-10000": "No interesado / no califica", complete: "No interesado / no califica", perdido: "No interesado / no califica",
  "no contesta": "No contesta",
  reflote: "Reflote", bad_timing: "Reflote", "bad timing": "Reflote",
  vendido: "Vendido", ganado: "Vendido",
};

export function normalizeCrmLeadStatus(value?: string | null): CrmLeadStatus {
  return STATUS_ALIASES[normalize(value)] || "Nuevo";
}

export function isMeetingStatus(value?: string) { return normalize(value) === "reunion"; }
export function isCrmLeadStatus(value: string): value is CrmLeadStatus { return CRM_LEAD_STATUS_VALUES.includes(value as CrmLeadStatus); }
export function leadStatusLabel(value: string) {
  const canonical = normalizeCrmLeadStatus(value);
  return CRM_LEAD_STATUS_OPTIONS.find((option) => option.value === canonical)?.label || value;
}

// Existing filter links remain valid until the migration has run.
export function leadStatusFilterValues(value: string): string[] {
  const canonical = normalizeCrmLeadStatus(value);
  return [...new Set(Object.entries(STATUS_ALIASES).filter(([, mapped]) => mapped === canonical).map(([alias]) => alias).concat(normalize(canonical)))];
}
export function leadStatusOptionsForValue(_value?: string) { return CRM_LEAD_STATUS_OPTIONS; }
