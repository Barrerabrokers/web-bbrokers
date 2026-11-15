import officialAreas from "@/lib/argentina-phone-areas.json";

// ENACOM: https://www.enacom.gob.ar/indicativos-interurbanos_p143
// Dataset downloaded 2026-10-14. Longest matching area code takes precedence.
const areas = [...officialAreas].sort((a, b) => b.code.length - a.code.length);

function findArgentinaPhoneArea(countryCode?: string | null, phone?: string | null) {
  const raw = String(phone || "").trim();
  let digits = raw.replace(/\D/g, "");
  const international = raw.startsWith("+") ? digits : raw.startsWith("00") ? digits.slice(2) : "";
  const dialCode = String(countryCode || "54").replace(/\D/g, "");
  if (international ? !international.startsWith("54") : !["54", "0054", "549", "00549"].includes(dialCode)) return null;
  if (digits.startsWith("0054")) digits = digits.slice(4);
  else if (digits.startsWith("54") && digits.length > 10) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("9") && digits.length > 10) digits = digits.slice(1);
  if (digits.length < 8 || digits.length > 12) return null;
  return areas.find(area => digits.startsWith(area.code)) || null;
}

/** Telephone area allocation is an origin suggestion, not a residence lookup. */
export function getArgentinaPhoneOrigin(countryCode?: string | null, phone?: string | null): string | null {
  const area = findArgentinaPhoneArea(countryCode, phone);
  if (!area) return null;
  if (area.code === "11") return "Buenos Aires (AMBA)";
  return area.locality === area.province ? area.province : `${area.locality}, ${area.province}`;
}

export function getArgentinaPhoneLocality(countryCode?: string | null, phone?: string | null): string | null {
  const area = findArgentinaPhoneArea(countryCode, phone);
  return area?.code === "11" ? "AMBA" : area?.locality || null;
}

/** AMBA spans CABA and Buenos Aires, so province requires manual confirmation. */
export function getArgentinaPhoneProvince(countryCode?: string | null, phone?: string | null): string | null {
  return findArgentinaPhoneArea(countryCode, phone)?.province || null;
}

/** Only fill the locality field when the prefix identifies a specific locality. */
export function getArgentinaPhoneLocalitySuggestion(countryCode?: string | null, phone?: string | null): string | null {
  const area = findArgentinaPhoneArea(countryCode, phone);
  return area && area.code !== "11" ? area.locality : null;
}
