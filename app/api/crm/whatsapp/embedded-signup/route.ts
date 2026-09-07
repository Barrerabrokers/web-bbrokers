import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { canViewAllCrmContacts } from "@/lib/roles";
import { getWhatsAppChannelCredentials, saveWhatsAppChannelCredentials } from "@/lib/whatsapp-credentials";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  code: z.string().min(1),
  wabaId: z.string().regex(/^\d+$/),
  phoneNumberId: z.string().regex(/^\d+$/),
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

  const appId = process.env.NEXT_PUBLIC_META_APP_ID || "1735228224390278";
  const appSecret = process.env.META_APP_SECRET;
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
  const phoneNumberId = parsed.data.phoneNumberId;
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

  let displayPhoneNumber = "";
  if (phoneNumberId) {
    const phoneResponse = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}?fields=display_phone_number,verified_name,status`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    if (phoneResponse.ok) {
      const phone = await phoneResponse.json();
      displayPhoneNumber = phone.display_phone_number || "";
    }
  }

  await saveWhatsAppChannelCredentials({ accessToken, wabaId, phoneNumberId, displayPhoneNumber });

  return NextResponse.json({ connected: true, wabaId, phoneNumberId, displayPhoneNumber });
}
