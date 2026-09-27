export const WHATSAPP_TEST_PHONE_ID = "1293452090522008";

export function selectWhatsAppSender(sourceId: string | undefined, primary: { token?: string; phoneNumberId?: string }, testToken?: string) {
  const phoneNumberId = sourceId || primary.phoneNumberId;
  const token = sourceId === WHATSAPP_TEST_PHONE_ID ? testToken : primary.token;
  if (!phoneNumberId || !/^\d+$/.test(phoneNumberId)) throw new Error("El identificador del número de WhatsApp no está configurado correctamente.");
  if (sourceId && sourceId !== WHATSAPP_TEST_PHONE_ID && sourceId !== primary.phoneNumberId) throw new Error("El número que recibió este chat no coincide con el canal conectado. No se envió el mensaje.");
  if (!token?.trim()) throw new Error(sourceId === WHATSAPP_TEST_PHONE_ID ? "Falta configurar el token del número de prueba." : "Faltan las credenciales oficiales de WhatsApp.");
  return { phoneNumberId, token: token.trim() };
}

export async function deliverWhatsAppText(sender: { token: string; phoneNumberId: string }, phone: string, text: string, version = "v23.0") {
  if (!/^v\d+\.\d+$/.test(version)) throw new Error("La versión de la API de WhatsApp no está configurada correctamente.");
  // Meta's test-recipient list uses Argentina's +54 format, while inbound wa_id includes 9.
  // Keep the canonical contact unchanged and never apply this test-only mapping in production.
  const recipient = sender.phoneNumberId === WHATSAPP_TEST_PHONE_ID && /^549\d{10}$/.test(phone)
    ? `54${phone.slice(3)}` : phone;
  let response: Response;
  try {
    response = await fetch(`https://graph.facebook.com/${version}/${sender.phoneNumberId}/messages`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${sender.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: recipient, type: "text", text: { preview_url: false, body: text } }),
    });
  } catch { throw new Error("No se pudo confirmar el envío con Meta. Revisá el teléfono antes de reintentar para evitar duplicados."); }
  const result = await response.json().catch(() => null);
  if (!result) throw new Error(`Meta devolvió una respuesta inesperada (HTTP ${response.status}). No se pudo confirmar el envío; revisá el teléfono antes de reintentar.`);
  if (!response.ok) {
    if (result.error?.code === 190) throw new Error("Meta rechazó el token de este número: puede estar vencido o revocado. Administración debe renovar la conexión.");
    if (result.error?.code === 131030) throw new Error("Meta no reconoce este teléfono en la lista de destinatarios de prueba. Revisá su autorización en Meta.");
    if (result.error?.code === 131047) throw new Error("La ventana para responder por WhatsApp está cerrada. Pedile al contacto que envíe un nuevo mensaje.");
    throw new Error(`WhatsApp rechazó el mensaje (código ${Number(result.error?.code) || response.status}). No se registró como enviado.`);
  }
  if (typeof result.messages?.[0]?.id !== "string") throw new Error("Meta no confirmó un identificador de envío. Revisá el teléfono antes de reintentar.");
  return result.messages[0].id as string;
}
