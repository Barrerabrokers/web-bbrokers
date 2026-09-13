import { NextRequest, NextResponse } from "next/server";
import { verifyWhatsAppSignature } from "@/lib/whatsapp-inbox";
import { processMetaMessages } from "@/lib/meta-message-webhook";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const token = process.env.META_MESSAGES_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN;
  if (token && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === token) return new NextResponse(params.get("hub.challenge") || "", { status: 200 });
  return NextResponse.json({ error: "Verificación rechazada" }, { status: 403 });
}
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"))) return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  let payload;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  try { await processMetaMessages(payload); } catch { return NextResponse.json({ error: "No se pudo registrar el mensaje; reintentar entrega." }, { status: 503 }); }
  return NextResponse.json({ received: true });
}
