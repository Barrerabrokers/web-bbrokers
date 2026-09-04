export const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";

const ARGENTINA_UTC_OFFSET = "-03:00";

export function argentinaLocalDateTimeToIso(dateOrDateTime: string, time?: string) {
  const localValue = time ? `${dateOrDateTime}T${time}` : dateOrDateTime;
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localValue)
    ? `${localValue}:00`
    : localValue;
  const parsed = new Date(`${withSeconds}${ARGENTINA_UTC_OFFSET}`);
  if (Number.isNaN(parsed.getTime())) throw new Error("La fecha u hora seleccionada no es válida.");
  return parsed.toISOString();
}

export function argentinaDateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ARGENTINA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function argentinaHour(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ARGENTINA_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Number(parts.find((item) => item.type === "hour")?.value || 0);
}
