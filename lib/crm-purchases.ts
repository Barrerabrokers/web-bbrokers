import { z } from "zod";

export const PURCHASES_KEY = "sales_import_pilot_v1";
const amount = z.number().finite().min(0).max(999999999999).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.001, "Usá hasta dos decimales");
export const purchaseSchema = z.object({
  id: z.string().uuid().optional(),
  signingAt: z.string().datetime().nullable().optional(),
  reservationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  collective: z.boolean().optional(),
  type: z.enum(["VENTA", "RESERVA", "REVENTA", "USADO"]),
  development: z.string().trim().min(1).max(200),
  units: z.array(z.string().trim().min(1).max(60)).min(1).max(100).refine(units => new Set(units.map(unit => unit.toLocaleLowerCase("es-AR"))).size === units.length, "No repitas una UF en la misma compra"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const date = new Date(`${value}T12:00:00Z`); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value; }, "Fecha inválida").nullable(),
  price: amount.nullable(), advance: amount.nullable(), balance: amount.nullable(),
});
export type Purchase = z.infer<typeof purchaseSchema>;
export type PurchaseHistoryData = { operations: Purchase[]; dni?: string; [key: string]: unknown };
export const purchaseActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), purchase: purchaseSchema }),
  z.object({ action: z.literal("edit"), index: z.number().int().min(0), purchase: purchaseSchema }),
  z.object({ action: z.literal("delete"), index: z.number().int().min(0), unitIndex: z.number().int().min(0) }),
]);
export const purchaseRequestSchema = z.object({ leadId: z.string().uuid(), version: z.string().max(2000000).nullable(), change: purchaseActionSchema });
export type PurchaseChange = z.infer<typeof purchaseActionSchema>;

export function readPurchaseHistory(value: unknown): PurchaseHistoryData {
  if (value === undefined || value === null || value === "") return { operations: [] };
  if (typeof value !== "string") throw new Error("El historial de compras tiene un formato inválido.");
  let data;
  try { data = JSON.parse(value); } catch { throw new Error("No se pudo leer el historial de compras."); }
  if (!data || !Array.isArray(data.operations) || !data.operations.every((purchase: unknown) => purchaseSchema.safeParse(purchase).success)) throw new Error("Revisá los datos del historial antes de editarlo.");
  return { ...data, operations: data.operations.map((purchase: Purchase) => ({ ...purchase, collective: purchase.collective || purchase.units.length > 1 })) };
}

export function applyPurchaseChange(data: PurchaseHistoryData, change: PurchaseChange, actorId: string, now: string): PurchaseHistoryData {
  const operations = data.operations.map(purchase => ({ ...purchase, units: [...purchase.units] }));
  const before = change.action === "add" ? null : operations[change.index];
  if (change.action !== "add" && !before) throw new Error("La compra ya no está disponible. Actualizá la ficha.");
  if (change.action === "add") operations.push(change.purchase);
  if (change.action === "edit") operations[change.index] = { ...before, ...change.purchase };
  if (change.action === "edit" && before?.type === "RESERVA" && change.purchase.type !== "RESERVA") {
    operations[change.index].reservationDate = before.reservationDate || before.date;
  }
  if (change.action === "delete") {
    if (!before?.units[change.unitIndex]) throw new Error("La unidad ya no está disponible.");
    const remaining = before.units.filter((_, index) => index !== change.unitIndex);
    if (remaining.length) operations[change.index] = { ...before, units: remaining };
    else operations.splice(change.index, 1);
  }
  // Retain the original operation for traceability, including deleted units.
  const audit = Array.isArray(data.audit) ? data.audit : [];
  return { ...data, currency: "USD", operations, audit: [...audit, { at: now, by: actorId, action: change.action, before, change }], updatedAt: now };
}
