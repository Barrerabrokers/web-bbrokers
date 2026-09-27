"use client";

import type { ChangeEventHandler } from "react";

export function MeetingClientInvitation({ value, onChange, disabled, email }: {
  value: boolean | undefined;
  onChange: ChangeEventHandler<HTMLSelectElement>;
  disabled?: boolean;
  email?: string;
}) {
  return <label className="block text-sm font-semibold text-ink sm:col-span-2">
    ¿Enviar la invitación de la reunión al cliente?
    <select required value={value === undefined ? "" : value ? "yes" : "no"} onChange={onChange} disabled={disabled}
      className="mt-2 block min-h-11 w-full rounded-lg border border-ink/25 bg-white px-3 py-2 font-normal focus:border-[#006b6b]">
      <option value="" disabled>Elegí una opción</option>
      <option value="yes" disabled={!email?.trim()}>Sí, enviar al cliente</option>
      <option value="no">No enviar al cliente</option>
    </select>
    <span className="mt-2 block font-normal text-ink/75">{email?.trim() ? "La invitación incluye título, fecha, horario y lugar o enlace de la reunión. Las notas internas no se comparten." : "Este contacto no tiene correo. Podés agendar sin enviarle una invitación."}</span>
  </label>;
}
