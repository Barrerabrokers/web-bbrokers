export function needsGoogleReconnection(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /invalid_grant|token has been expired or revoked|token.*(?:expired|revoked)|reconectá tu cuenta de google/i.test(message);
}

export function normalizeSmtpPassword(provider: string | undefined, password: string) {
  return provider === "gmail" ? password.replace(/\s+/g, "") : password;
}

export function friendlySmtpError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (needsGoogleReconnection(error)) return "La autorización de Google venció o fue revocada. Reconectá tu cuenta de Google desde tu sesión del CRM para volver a enviar correos.";
  if (
    message.includes("535-5.7.8") ||
    message.includes("535 5.7.8") ||
    message.toLowerCase().includes("username and password not accepted") ||
    message.toLowerCase().includes("badcredentials")
  ) {
    return "Gmail rechazó el usuario o la contraseña. Activá la verificación en 2 pasos en Google y usá una contraseña de aplicación de 16 caracteres, no tu contraseña normal. Pegala sin espacios.";
  }
  if (
    message.includes("534-5.7.9") ||
    message.includes("534 5.7.9") ||
    message.toLowerCase().includes("application-specific password required")
  ) {
    return "Gmail requiere una contraseña de aplicación para este acceso SMTP.";
  }
  return message || "No se pudo conectar con el servidor de correo.";
}
