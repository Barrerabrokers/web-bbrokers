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
  { value: "ATTEMPTED_TO_CONTACT", label: "Attempted to Contact" },
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

export const CRM_LEAD_STATUS_VALUES = CRM_LEAD_STATUS_OPTIONS.map((option) => option.value);

export function isCrmLeadStatus(value: string): value is CrmLeadStatus {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 120;
}

export function leadStatusLabel(value: string) {
  return CRM_LEAD_STATUS_OPTIONS.find((option) => option.value === value)?.label || value;
}

export function leadStatusOptionsForValue(value?: string) {
  if (!value || HUBSPOT_LEAD_STATUS_OPTIONS.some((option) => option.value === value)) {
    return HUBSPOT_LEAD_STATUS_OPTIONS;
  }

  const current = CRM_LEAD_STATUS_OPTIONS.find((option) => option.value === value);
  return current ? [current, ...HUBSPOT_LEAD_STATUS_OPTIONS] : HUBSPOT_LEAD_STATUS_OPTIONS;
}
