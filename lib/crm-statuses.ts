export const HUBSPOT_LEAD_STATUS_OPTIONS = [
  { value: "NEW", label: "Nuevo" },
  { value: "Interesado", label: "Interesado" },
  { value: "En curso", label: "En curso" },
  { value: "Reunion", label: "Reunion" },
  { value: "Reservado", label: "Reservado" },
  { value: "No Interesado", label: "No Interesado" },
  { value: "No existe", label: "No existe" },
  { value: "OPEN", label: "Abierto" },
  { value: "UNQUALIFIED", label: "No calificado" },
  { value: "No Contesta", label: "No Contesta" },
  { value: "Reflote", label: "Reflote" },
  { value: "Contactado", label: "Contactado" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "OPEN_DEAL", label: "Open Deal" },
  { value: "ATTEMPTED_TO_CONTACT", label: "Intento de contacto" },
  { value: "CONNECTED", label: "Connected" },
  { value: "BAD_TIMING", label: "Bad Timing" },
  { value: "-10000", label: "-10000" },
  { value: "Vendido", label: "Vendido" },
] as const;

const LEGACY_CRM_LEAD_STATUS_OPTIONS = [
  { value: "nuevo", label: "Nuevo" },
  { value: "contactado", label: "Contactado" },
  { value: "calificado", label: "Calificado" },
  { value: "visita", label: "Visita" },
  { value: "propuesta", label: "Propuesta" },
  { value: "reservado", label: "Reservado" },
  { value: "perdido", label: "Perdido" },
] as const;

export const CRM_LEAD_STATUS_OPTIONS = [
  ...HUBSPOT_LEAD_STATUS_OPTIONS,
  ...LEGACY_CRM_LEAD_STATUS_OPTIONS,
] as const;

export type CrmLeadStatus = string;
export function isMeetingStatus(value?: string) {
  return value?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === "reunion";
}

export const CRM_LEAD_STATUS_VALUES = CRM_LEAD_STATUS_OPTIONS.map((option) => option.value);

export function isCrmLeadStatus(value: string): value is CrmLeadStatus {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 120;
}

export function leadStatusLabel(value: string) {
  return CRM_LEAD_STATUS_OPTIONS.find((option) => option.value === value)?.label || value;
}

// Imported codes and their displayed labels represent the same filter option.
// Keep unrelated/custom statuses distinct, and never rewrite historical data.
export function leadStatusFilterValues(value: string): string[] {
  const normalize = (text: string) => text.trim().toLowerCase();
  const values = new Set([normalize(value)]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const option of CRM_LEAD_STATUS_OPTIONS) {
      const code = normalize(option.value);
      const label = normalize(option.label);
      if (values.has(code) || values.has(label)) {
        const before = values.size;
        values.add(code);
        values.add(label);
        changed ||= values.size !== before;
      }
    }
  }
  return [...values];
}

export function leadStatusOptionsForValue(value?: string) {
  if (!value || HUBSPOT_LEAD_STATUS_OPTIONS.some((option) => option.value === value)) {
    return HUBSPOT_LEAD_STATUS_OPTIONS;
  }

  const current = CRM_LEAD_STATUS_OPTIONS.find((option) => option.value === value);
  return current ? [current, ...HUBSPOT_LEAD_STATUS_OPTIONS] : HUBSPOT_LEAD_STATUS_OPTIONS;
}
