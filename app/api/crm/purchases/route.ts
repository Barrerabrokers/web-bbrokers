import { after } from "next/server";
import { processReservationCalendars } from "@/lib/crm-reservation-calendar";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { purchaseRequestSchema } from "@/lib/crm-purchases";
import { saveCrmPurchaseChange } from "@/lib/crm-purchases-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "admin") return NextResponse.json({ error: "Solo los administradores pueden modificar las compras." }, { status: 403 });
  const parsed = purchaseRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá fecha, desarrollo, unidades e importes. Los importes deben ser positivos o cero, con hasta dos decimales." }, { status: 400 });
  if (parsed.data.change.action !== "delete") {
    const purchase = parsed.data.change.purchase;
    if (purchase.type === "RESERVA" && !purchase.date) return NextResponse.json({ error: "Completá la fecha de la reserva." }, { status: 400 });
    if (purchase.signingAt && purchase.date && new Date(new Date(purchase.signingAt).getTime() - 3 * 3600000).toISOString().slice(0, 10) < purchase.date) return NextResponse.json({ error: "La firma no puede ser anterior a la fecha de la operación." }, { status: 400 });
  }
  try {
    const result = await saveCrmPurchaseChange(parsed.data.leadId, parsed.data.version, parsed.data.change, session.user.id);
    if (result.status === 200) after(async () => { await processReservationCalendars(parsed.data.leadId).catch(error => console.error("Reservation calendar sync:", error)); });
    return NextResponse.json(result, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Error saving CRM purchase:", error);
    return NextResponse.json({ error: "No se pudo guardar la compra. Los cambios no se aplicaron; volvé a intentarlo." }, { status: 500 });
  }
}
