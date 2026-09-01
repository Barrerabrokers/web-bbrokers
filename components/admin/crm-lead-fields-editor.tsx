"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Trash2 } from "lucide-react";
import type { CrmLead, CrmLeadStatus } from "@/lib/db";
import { leadStatusOptionsForValue } from "@/lib/crm-statuses";
import { PHONE_COUNTRIES, normalizeDialCode } from "@/lib/phone-countries";

type DevelopmentOption = {
  id: string;
  name: string;
};

type AgentOption = {
  id: string;
  name: string;
  email: string;
};

type CrmLeadFieldsEditorProps = {
  lead: CrmLead;
  developments: DevelopmentOption[];
  agents?: AgentOption[];
  canAssignOwner?: boolean;
  canDelete?: boolean;
};

export function CrmLeadFieldsEditor({
  lead,
  developments,
  agents = [],
  canAssignOwner = false,
  canDelete = false,
}: CrmLeadFieldsEditorProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(lead.firstName);
  const [lastName, setLastName] = useState(lead.lastName);
  const [email, setEmail] = useState(lead.email);
  const [countryCode, setCountryCode] = useState(normalizeDialCode(lead.countryCode || "+54"));
  const [phone, setPhone] = useState(lead.phone);
  const [status, setStatus] = useState<CrmLeadStatus>(lead.status);
  const [developmentId, setDevelopmentId] = useState(lead.developmentId || "");
  const [developmentNameText, setDevelopmentNameText] = useState(
    lead.developmentNameText || (!lead.developmentId ? lead.developmentName || "" : "")
  );
  const [assignedAgentId, setAssignedAgentId] = useState(lead.assignedAgentId || "");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const save = async (payload: {
    firstName?: string;
    lastName?: string;
    email?: string;
    countryCode?: string;
    phone?: string;
    status?: CrmLeadStatus;
    developmentId?: string;
    developmentNameText?: string;
    assignedAgentId?: string;
  }) => {
    setNotice("");
    setError("");

    try {
      const response = await fetch("/api/crm/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lead.id,
          ...payload,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo guardar el cambio");
      }

      setNotice("Guardado");
      startTransition(() => router.refresh());
      window.setTimeout(() => setNotice(""), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cambio");
    }
  };

  const deleteLead = async () => {
    const confirmed = window.confirm(
      `¿Estás seguro de borrar el contacto ${lead.firstName} ${lead.lastName}? Esta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch(`/api/crm/leads?id=${encodeURIComponent(lead.id)}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error || "No se pudo eliminar el contacto");
      }

      router.push("/admin/crm");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el contacto");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save({
          firstName,
          lastName,
          email,
          countryCode: normalizeDialCode(countryCode),
          phone,
          status,
          ...(developmentId.startsWith("text:")
            ? {
                developmentId: "",
                developmentNameText:
                  developments.find((development) => development.id === developmentId)?.name ||
                  developmentId.replace(/^text:/, ""),
              }
            : {
                developmentId,
                developmentNameText:
                  developments.find((development) => development.id === developmentId)?.name ||
                  developmentNameText,
              }),
          assignedAgentId,
        });
      }}
      className="min-w-0 rounded-xl border border-ink/12 bg-white p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Información del cliente</h2>
        </div>
        {(notice || isPending) && (
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-800">
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {notice || "Actualizando"}
          </span>
        )}
      </div>

      <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <div className="grid gap-3 sm:contents">
          <label className="block">
            <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.16em] text-ink/45">
              Nombre
            </span>
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="h-11 w-full min-w-0 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15"
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.16em] text-ink/45">
              Apellido
            </span>
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="h-11 w-full min-w-0 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15"
              required
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.16em] text-ink/45">
            Correo
          </span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 w-full min-w-0 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15"
            type="email"
            required
          />
        </label>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] xl:col-span-1 xl:grid-cols-1 2xl:col-span-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <label className="block">
            <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.16em] text-ink/45">
              País
            </span>
            <select
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value)}
              className="h-11 w-full min-w-0 truncate rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15"
              required
            >
              {PHONE_COUNTRIES.map((country) => (
                <option key={`${country.iso2}-${country.dialCode}`} value={country.dialCode}>
                  {country.name} ({country.dialCode})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.16em] text-ink/45">
              Teléfono
            </span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="h-11 w-full min-w-0 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15"
              required
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.16em] text-ink/45">
            Estado del lead
          </span>
          <select
            value={status}
            onChange={(event) => {
              const nextStatus = event.target.value as CrmLeadStatus;
              setStatus(nextStatus);
            }}
            className="h-11 w-full min-w-0 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15"
          >
            {leadStatusOptionsForValue(status).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.16em] text-ink/45">
            Desarrollo
          </span>
          <select
            value={developmentId}
            onChange={(event) => {
              const nextDevelopmentId = event.target.value;
              setDevelopmentId(nextDevelopmentId);
              if (nextDevelopmentId.startsWith("text:")) {
                setDevelopmentNameText(
                  developments.find((development) => development.id === nextDevelopmentId)?.name ||
                    nextDevelopmentId.replace(/^text:/, "")
                );
              }
            }}
            className="h-11 w-full min-w-0 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15"
          >
            <option value="">{developmentNameText || "Sin definir"}</option>
            {developments.map((development) => (
              <option key={development.id} value={development.id}>
                {development.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.16em] text-ink/45">
            Propietario del contacto
          </span>
          <select
            value={assignedAgentId}
            disabled={!canAssignOwner}
            onChange={(event) => {
              const nextAgentId = event.target.value;
              setAssignedAgentId(nextAgentId);
            }}
            className="h-11 w-full min-w-0 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15 disabled:cursor-not-allowed disabled:bg-cream-100 disabled:text-ink/50"
          >
            <option value="">Sin asignar</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name || agent.email}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-bone transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Guardar información
      </button>

      {canDelete && (
        <div className="mt-5 border-t border-ink/10 pt-4">
          <button
            type="button"
            onClick={deleteLead}
            disabled={isDeleting}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Borrar contacto
          </button>
          <p className="mt-2 text-xs leading-relaxed text-ink/45">
            Solo administradores pueden eliminar contactos del CRM.
          </p>
        </div>
      )}
    </form>
  );
}
