export function isValidBirthDate(value: string): boolean {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01") return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value <= today;
}

export function getCrmContactBirthDate(properties: Record<string, unknown> | undefined): string {
  const value = properties?.crm_birth_date;
  return typeof value === "string" && isValidBirthDate(value) ? value : "";
}

export function crmBirthDatePatch(birthDate?: string): Record<string, string> {
  return typeof birthDate === "string" ? { crm_birth_date: birthDate } : {};
}
