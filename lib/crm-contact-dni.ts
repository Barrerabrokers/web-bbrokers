export function getCrmContactDni(properties: Record<string, unknown> | undefined): string {
  // An explicit empty value clears the imported fallback too.
  if (typeof properties?.crm_dni === "string") return properties.crm_dni.trim();
  try {
    const history = typeof properties?.sales_import_pilot_v1 === "string" ? JSON.parse(properties.sales_import_pilot_v1) : null;
    if (typeof history?.dni === "string") return history.dni.trim();
    if (typeof history?.dni === "number" && Number.isSafeInteger(history.dni)) return String(history.dni);
  } catch { /* Invalid import data must not block editing the contact. */ }
  return "";
}

export function crmDniPatch(dni?: string): Record<string, string> {
  return typeof dni === "string" ? { crm_dni: dni.trim() } : {};
}
