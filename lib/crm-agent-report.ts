import { argentinaDateKey } from "./argentina-time";

export const REPORT_PERIODS = [
  ["today", "Hoy"], ["yesterday", "Ayer"], ["this_week", "Esta semana"],
  ["last_week", "La semana pasada"], ["this_month", "Este mes"],
  ["date", "Una fecha"], ["range", "Entre fechas"], ["year", "Todo el año"],
] as const;
export type ReportPeriod = typeof REPORT_PERIODS[number][0];
export const REPORT_CHANNELS = ["llamada", "correo", "whatsapp", "reunion", "respuesta"] as const;
export type ReportChannel = typeof REPORT_CHANNELS[number];
export type ReportCounts = Record<ReportChannel, number>;
export const EMPTY_COUNTS: ReportCounts = { llamada: 0, correo: 0, whatsapp: 0, reunion: 0, respuesta: 0 };
export type ReportRange = { from: string; to: string; start: string; end: string; period: ReportPeriod };
const dayMs = 86400000;
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error("Elegí una fecha válida.");
  return value;
}
function shift(value: string, days: number) { return new Date(new Date(`${value}T12:00:00Z`).getTime() + days * dayMs).toISOString().slice(0, 10); }
export function resolveReportRange(input: { period?: string; date?: string; from?: string; to?: string; year?: string }, now = new Date()): ReportRange {
  const period = input.period || "today";
  if (!REPORT_PERIODS.some(([value]) => value === period)) throw new Error("Período no válido.");
  const today = argentinaDateKey(now); let from = today, to = today;
  const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  if (period === "yesterday") from = to = shift(today, -1);
  if (period === "this_week") { from = shift(today, -weekday); to = shift(from, 6); }
  if (period === "last_week") { from = shift(today, -weekday - 7); to = shift(from, 6); }
  if (period === "this_month") { from = `${today.slice(0, 7)}-01`; const d = new Date(`${from}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); to = shift(d.toISOString().slice(0, 10), -1); }
  if (period === "date") from = to = validDate(input.date || today);
  if (period === "range") { from = validDate(input.from || today); to = validDate(input.to || today); }
  if (period === "year") { const year = Number(input.year || today.slice(0, 4)); if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("Elegí un año entre 2000 y 2100."); from = `${year}-01-01`; to = `${year}-12-31`; }
  if (from > to) throw new Error("La fecha inicial debe ser anterior o igual a la final.");
  if ((new Date(to).getTime() - new Date(from).getTime()) / dayMs > 365) throw new Error("Consultá un máximo de 366 días por vez.");
  return { from, to, start: `${from}T00:00:00-03:00`, end: `${shift(to, 1)}T00:00:00-03:00`, period: period as ReportPeriod };
}
export function resolveAgentScope(actor: { id: string; role: string }, requested?: string | null) {
  if (!["admin", "agent", "marketing"].includes(actor.role)) throw new Error("No autorizado");
  if (actor.role === "admin") return !requested || requested === "all" ? null : requested;
  if (requested && requested !== actor.id) throw new Error("Solo podés consultar tu propia actividad.");
  return actor.id;
}
export function responseRate(replied: number, contacted: number): number | null { return contacted ? Math.round(1000 * replied / contacted) / 10 : null; }
export type ReportActivity = { id: string; leadId: string | null; contact: string; agentId: string | null; agent: string; channel: ReportChannel; at: string; title: string; body: string; canOpen: boolean };
export type AgentReport = {
  range: ReportRange; scope: string | null; admin: boolean; generatedAt: string;
  agents: { id: string; name: string; active: boolean }[];
  totals: ReportCounts; contacted: number; replied: number; responseRate: number | null;
  days: ({ day: string } & ReportCounts)[];
  team: ({ id: string | null; name: string; contacted: number; replied: number } & ReportCounts)[];
  activities: ReportActivity[]; totalActivities: number; page: number; pageSize: number;
};
export function chartBuckets(range: ReportRange, days: AgentReport["days"]) {
  const count = Math.round((new Date(range.to).getTime() - new Date(range.from).getTime()) / dayMs) + 1;
  const monthly = count > 93, weekly = count > 31 && !monthly;
  const buckets = new Map<string, { day: string } & ReportCounts>();
  const bucketKey = (date: string) => monthly ? `${date.slice(0, 7)}-01` : weekly ? shift(range.from, Math.floor((new Date(date).getTime() - new Date(range.from).getTime()) / dayMs / 7) * 7) : date;
  for (let i = 0; i < count; i++) { const key = bucketKey(shift(range.from, i)); if (!buckets.has(key)) buckets.set(key, { day: key, ...EMPTY_COUNTS }); }
  for (const day of days) { const bucket = buckets.get(bucketKey(day.day)); if (bucket) for (const channel of REPORT_CHANNELS) bucket[channel] += Number(day[channel] || 0); }
  return { mode: monthly ? "mes" : weekly ? "semana" : "día", buckets: Array.from(buckets.values()) };
}
