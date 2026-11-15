import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { canViewAllCrmContacts } from "@/lib/roles";
import { getWhatsAppChannelCredentials, saveWhatsAppChannelCredentials } from "@/lib/whatsapp-credentials";
import { getWhatsAppAppId, getWhatsAppAppSecret } from "@/lib/meta-app-config";
import { FIRST_CONTACT_WHATSAPP_NUMBER } from "@/lib/whatsapp-inbox-scope";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  code: z.string().min(1),
  wabaId: z.string().regex(/^\d+$/),
  phoneNumberId: z.string().regex(/^\d+$/).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !canViewAllCrmContacts(session.user.role)) {
    return NextResponse.json({ error: "Solo los administradores pueden consultar canales." }, { status: 403 });
  }
  const credentials = await getWhatsAppChannelCredentials();
  return NextResponse.json({
    connected: Boolean(credentials),
    displayPhoneNumber: credentials?.displayPhoneNumber || "",
    wabaId: credentials?.wabaId || "",
    phoneNumberId: credentials?.phoneNumberId || "",
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !canViewAllCrmContacts(session.user.role)) {
    return NextResponse.json({ error: "Solo los administradores pueden conectar canales." }, { status: 403 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Meta no devolvió una autorización válida." }, { status: 400 });

  const appId = getWhatsAppAppId();
  const appSecret = getWhatsAppAppSecret();
  if (!appSecret) return NextResponse.json({ error: "Falta configurar el secreto de la aplicación de Meta." }, { status: 503 });

  const tokenUrl = new URL("https://graph.facebook.com/v23.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("code", parsed.data.code);
  const tokenResponse = await fetch(tokenUrl, { cache: "no-store", signal: AbortSignal.timeout(25_000) });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) {
    return NextResponse.json({ error: tokenData?.error?.message || "Meta rechazó la autorización." }, { status: 502 });
  }

  const accessToken = String(tokenData.access_token);
  const wabaId = parsed.data.wabaId;
  // The Business App completion event may omit phone_number_id. Resolve it
  // through the authorized WABA rather than waiting forever in the browser.
  const phonesResponse = await fetch(`https://graph.facebook.com/v23.0/${wabaId}/phone_numbers?fields=id,display_phone_number&limit=100`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  const phones = await phonesResponse.json();
  if (!phonesResponse.ok || !Array.isArray(phones.data)) {
    return NextResponse.json({ error: phones?.error?.message || "No se pudo consultar el número autorizado por Meta." }, { status: 502 });
  }
  const normalize = (value: string) => value.replace(/\D/g, "").replace(/^549/, "54");
  const phone = phones.data.find((candidate: { id?: string; display_phone_number?: string }) =>
    (!parsed.data.phoneNumberId || candidate.id === parsed.data.phoneNumberId) &&
    normalize(candidate.display_phone_number || "") === normalize(FIRST_CONTACT_WHATSAPP_NUMBER)
  );
  if (!phone?.id) {
    return NextResponse.json({ error: `La cuenta autorizada no incluye el número ${FIRST_CONTACT_WHATSAPP_NUMBER}. Volvé a conectar la cuenta de WhatsApp Business correspondiente.` }, { status: 400 });
  }
  const phoneNumberId = String(phone.id);
  const displayPhoneNumber = String(phone.display_phone_number);
  if (wabaId) {
    const subscription = await fetch(`https://graph.facebook.com/v23.0/${wabaId}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    if (!subscription.ok) {
      const error = await subscription.json().catch(() => null);
      return NextResponse.json({ error: error?.error?.message || "No se pudo activar el webhook de WhatsApp." }, { status: 502 });
    }
  }

  await saveWhatsAppChannelCredentials({ accessToken, wabaId, phoneNumberId, displayPhoneNumber });

  return NextResponse.json({ connected: true, wabaId, phoneNumberId, displayPhoneNumber });
}
