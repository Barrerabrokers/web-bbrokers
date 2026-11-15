export function getCrmContactCompany(properties: Record<string, unknown> | undefined): string {
  return typeof properties?.crm_company_name === "string" ? properties.crm_company_name.trim() : "";
}

export function crmCompanyPatch(companyName?: string): Record<string, string> {
  return typeof companyName === "string" ? { crm_company_name: companyName.trim() } : {};
}
