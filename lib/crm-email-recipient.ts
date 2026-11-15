import { z } from "zod";

export const MISSING_RECIPIENT_MESSAGE = "Este contacto no tiene un correo válido. Completá el campo Correo en Información del contacto y guardá los cambios antes de enviar.";

export function hasValidEmailRecipient(email: unknown): email is string {
  return typeof email === "string" && z.string().trim().email().safeParse(email).success;
}
