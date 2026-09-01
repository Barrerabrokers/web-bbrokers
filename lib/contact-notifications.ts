import { getSiteSettings } from "@/lib/db";

type ContactNotificationInput = {
  name: string;
  email: string;
  phone?: string;
  message: string;
  propertyId?: string;
};

type AgentPasswordResetInput = {
  agentName: string;
  agentEmail: string;
  resetUrl: string;
  requestedBy?: string | null;
};

type ResendPayload = {
  from: string;
  to: string[];
  reply_to?: string;
  subject: string;
  text: string;
};

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export async function sendContactNotification(input: ContactNotificationInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, skipped: true, reason: "Missing RESEND_API_KEY" };
  }

  const settings = await getSiteSettings();
  const to = process.env.CONTACT_EMAIL_TO || settings.email;
  const from =
    process.env.CONTACT_EMAIL_FROM ||
    "Barrera Brokers <onboarding@resend.dev>";

  if (!to) {
    return { sent: false, skipped: true, reason: "Missing recipient email" };
  }

  const subject = sanitizeHeader(`Nueva consulta web - ${input.name}`);
  const text = [
    "Nueva consulta recibida desde barrerabrokers.com",
    "",
    `Nombre: ${input.name}`,
    `Email: ${input.email}`,
    `Telefono: ${input.phone || "No informado"}`,
    input.propertyId ? `Referencia: ${input.propertyId}` : null,
    "",
    "Mensaje:",
    input.message,
  ]
    .filter(Boolean)
    .join("\n");

  const payload: ResendPayload = {
    from,
    to: [to],
    reply_to: input.email,
    subject,
    text,
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend error ${response.status}: ${errorText}`);
  }

  return { sent: true, skipped: false };
}

export async function sendAgentPasswordResetEmail(input: AgentPasswordResetInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Falta configurar RESEND_API_KEY para enviar emails.");
  }

  const settings = await getSiteSettings();
  const from =
    process.env.AUTH_EMAIL_FROM ||
    process.env.CONTACT_EMAIL_FROM ||
    "Barrera Brokers <onboarding@resend.dev>";
  const replyTo = process.env.CONTACT_EMAIL_TO || settings.email;

  const subject = sanitizeHeader("Restablecer contraseña - Barrera Brokers");
  const text = [
    `Hola ${input.agentName},`,
    "",
    "Se generó un enlace para que puedas cambiar tu contraseña del portal de Barrera Brokers.",
    "",
    "Abrí este link y cargá una nueva contraseña:",
    input.resetUrl,
    "",
    "El enlace vence en 2 horas y solo puede usarse una vez.",
    input.requestedBy ? `Solicitado por: ${input.requestedBy}` : null,
    "",
    "Si no esperabas este correo, podés ignorarlo.",
  ]
    .filter(Boolean)
    .join("\n");

  const payload: ResendPayload = {
    from,
    to: [input.agentEmail],
    reply_to: replyTo,
    subject,
    text,
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend error ${response.status}: ${errorText}`);
  }

  return { sent: true };
}
