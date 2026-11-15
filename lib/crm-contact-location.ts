import { getArgentinaPhoneProvince, getArgentinaPhoneLocalitySuggestion } from "@/lib/argentina-phone-origin";
import { PHONE_COUNTRIES, normalizeDialCode } from "@/lib/phone-countries";

export type CrmContactLocation = { address: string; locality: string; province: string; country?: string };

export const ARGENTINA_PROVINCES = ["Buenos Aires", "Ciudad Autónoma de Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"];

export function getCrmContactLocation(properties: Record<string, unknown> | undefined, countryCode?: string, phone?: string): CrmContactLocation {
  let importedAddress = "";
  try {
    const imported = typeof properties?.sales_import_pilot_v1 === "string" ? JSON.parse(properties.sales_import_pilot_v1) : null;
    if (typeof imported?.address === "string") importedAddress = imported.address.trim();
  } catch { /* An invalid import must not prevent editing the contact. */ }
  const value = (key: string, fallback = "") => typeof properties?.[key] === "string" ? (properties[key] as string).trim() : fallback;
  return { address: value("crm_address", importedAddress), locality: value("crm_locality", getArgentinaPhoneLocalitySuggestion(countryCode, phone) || ""), province: value("crm_province", getArgentinaPhoneProvince(countryCode, phone) || ""), country: value("crm_country", (countryCode || phone ? getPhoneCountryName(countryCode, phone) : null) || "") };
}

export function crmLocationPatch(location?: Partial<CrmContactLocation>): Record<string, string> {
  const patch: Record<string, string> = {};
  for (const field of ["address", "locality", "province", "country"] as const) {
    if (typeof location?.[field] === "string") patch[`crm_${field}`] = location[field].trim();
  }
  return patch;
}

export function getPhoneCountryName(countryCode?: string, phone?: string): string | null {
  const international = String(phone || "").trim();
  const codes = [...new Set(PHONE_COUNTRIES.map(country => country.dialCode))].sort((a, b) => b.length - a.length);
  const fullPhone = international.startsWith("+") ? `+${international.replace(/\D/g, "")}` : international.startsWith("00") ? `+${international.replace(/\D/g, "").slice(2)}` : "";
  const code = fullPhone ? codes.find(code => fullPhone.startsWith(code)) : normalizeDialCode(countryCode || "+54");
  const names = [...new Set(PHONE_COUNTRIES.filter(country => country.dialCode === code).map(country => country.name))];
  return names.length === 1 ? names[0] : null;
}
