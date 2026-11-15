import history from "@/lib/cac-history.json";

export type CacSeries = "general" | "materials" | "labor";
export type CacRow = typeof history.rows[number];
export const CAC_HISTORY = history;
export const CAC_SOURCES = {
  sheet: "https://docs.google.com/spreadsheets/d/1CGVDk9hzVZv4-YM8yH0CXP49uxjGNvrS/edit?usp=sharing",
  cifras: "https://www.cifrasonline.com.ar/indice-cac/",
  pdf: "https://drive.google.com/file/d/1UGpKRoU_jD1I1_ensHmkokA6R0tmp5ao/view",
  camarco: "https://www.camarco.org.ar/2026/10/20/indicador-camarco-septiembre-2026/",
  archive: "https://www.camarco.org.ar/indicadores/indicadores-de-costos/",
};
export const CAC_SERIES: { value: CacSeries; label: string }[] = [{ value: "general", label: "Costo de construcción" }, { value: "materials", label: "Materiales" }, { value: "labor", label: "Mano de obra" }];
export function cacPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}
export function cacNumber(value: number) { return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value); }
export function cacPercent(value: number | null) { return value === null ? "—" : `${value > 0 ? "+" : ""}${cacNumber(value)} %`; }
export function cacVariation(period: string, series: CacSeries, comparison: "annual" | "yearToDate", rows: CacRow[] = history.rows) {
  const current = rows.find(row => row.period === period);
  const [year, month] = period.split("-");
  const base = rows.find(row => row.period === `${Number(year) - 1}-${comparison === "annual" ? month : "12"}`);
  return current && base && base[series] > 0 ? (current[series] / base[series] - 1) * 100 : null;
}
