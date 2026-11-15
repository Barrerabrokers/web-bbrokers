import { randomUUID } from "crypto";
import { ensureReservationCalendars, updateReservationActivities } from "@/lib/crm-reservation-calendar";
import type postgres from "postgres";
import { getSharedDatabase, releaseSharedDatabase } from "@/lib/database-pool";
import { applyPurchaseChange, PURCHASES_KEY, readPurchaseHistory, type PurchaseChange } from "@/lib/crm-purchases";

export async function saveCrmPurchaseChange(leadId: string, version: string | null, change: PurchaseChange, actorId: string) {
  const sql = getSharedDatabase();
  try {
    await ensureReservationCalendars(sql);
    return await sql.begin(async tx => {
      const [lead] = await tx`SELECT meta_properties, assigned_agent_id FROM crm_leads WHERE id = ${leadId} FOR UPDATE`;
      if (!lead) return { status: 404, error: "No se encontró el contacto." };
      const current = lead.meta_properties?.[PURCHASES_KEY] ?? null;
      if (current !== version) return { status: 409, error: "Otra persona actualizó las compras. Actualizá la ficha antes de volver a guardar." };
      const before = readPurchaseHistory(current);
      const safeChange = change.action === "delete" ? change : { ...change, purchase: { ...change.purchase, reservationDate: change.action === "edit" ? before.operations[change.index]?.reservationDate || null : null, id: change.action === "edit" ? before.operations[change.index]?.id || randomUUID() : randomUUID() } };
      const history = applyPurchaseChange(before, safeChange, actorId, new Date().toISOString());
      for (const operation of history.operations) operation.id ||= randomUUID();
      await updateReservationActivities(tx as unknown as ReturnType<typeof postgres>, leadId, history, actorId);
      const nextVersion = JSON.stringify(history);
      await tx`UPDATE crm_leads SET meta_properties = COALESCE(meta_properties, '{}'::jsonb) || ${tx.json({ [PURCHASES_KEY]: nextVersion })}, updated_at = NOW() WHERE id = ${leadId}`;
      return { status: 200, version: nextVersion, ...(history.operations.some(operation => operation.signingAt) && !lead.assigned_agent_id ? { warning: "Guardado. La firma figura en la agenda de los administradores; asigná un agente al contacto para incluirla en su agenda. Google Calendar se sincroniza con las cuentas conectadas." } : {}) };
    });
  } finally { await releaseSharedDatabase(sql); }
}
