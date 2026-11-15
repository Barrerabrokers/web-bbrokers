"use client";

import { getCrmContactCompany } from "@/lib/crm-contact-company";
import { getArgentinaPhoneProvince, getArgentinaPhoneLocalitySuggestion } from "@/lib/argentina-phone-origin";
import { ARGENTINA_PROVINCES, getCrmContactLocation, getPhoneCountryName } from "@/lib/crm-contact-location";
import { getCrmContactBirthDate } from "@/lib/crm-contact-birth-date";
import { getCrmContactDni } from "@/lib/crm-contact-dni";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Copy, ExternalLink, Loader2, MapPin, Trash2 } from "lucide-react";
import type { CrmLead, CrmLeadStatus } from "@/lib/db";
import { isMeetingStatus, leadStatusOptionsForValue } from "@/lib/crm-statuses";
import { PHONE_COUNTRIES, normalizeDialCode } from "@/lib/phone-countries";
import { getArgentinaPhoneLocality } from "@/lib/argentina-phone-origin";

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
  occupations?: { value: string; label: string }[];
  agents?: AgentOption[];
  canAssignOwner?: boolean;
  canDelete?: boolean;
};

function socialProfileHref(value: string, source: string) {
  const profile = value.trim();
  if (!profile) return "";
  if (/^https?:\/\//i.test(profile)) return profile;
  if (/^(?:www\.)?(instagram|facebook)\.com\//i.test(profile)) return `https://${profile.replace(/^www\./i, "")}`;

  const handle = profile.replace(/^@/, "").trim();
  if (!handle || /\s/.test(handle)) return "";
  if (/instagram/i.test(source)) return `https://www.instagram.com/${encodeURIComponent(handle)}/`;
  if (/facebook/i.test(source)) return `https://www.facebook.com/${encodeURIComponent(handle)}`;
  return "";
}

export function CrmLeadFieldsEditor({
  lead,
  developments,
  occupations = [],
  agents = [],
  canAssignOwner = false,
  canDelete = false,
}: CrmLeadFieldsEditorProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(lead.firstName);
  const [lastName, setLastName] = useState(lead.lastName);
  const [companyName, setCompanyName] = useState(() => getCrmContactCompany(lead.metaProperties));
  const [birthDate, setBirthDate] = useState(() => getCrmContactBirthDate(lead.metaProperties));
  const [dni, setDni] = useState(() => getCrmContactDni(lead.metaProperties));
  const [email, setEmail] = useState(lead.email);
  const [occupation, setOccupation] = useState(lead.occupation || "");
  const [website, setWebsite] = useState(lead.website || "");
  const websiteHref = /^https?:\/\//i.test(website.trim()) ? website.trim() : "";
  const [countryCode, setCountryCode] = useState(normalizeDialCode(lead.countryCode || "+54"));
  const [phone, setPhone] = useState(lead.phone);
  const [socialProfile, setSocialProfile] = useState(lead.socialProfile || "");
  const [linkedinProfile, setLinkedinProfile] = useState(lead.linkedinProfile || "");
  const [status, setStatus] = useState<CrmLeadStatus>(lead.status);
  useEffect(() => setStatus(lead.status), [lead.status]);
  const [campaignName, setCampaignName] = useState(lead.campaignName || "");
  const [developmentId, setDevelopmentId] = useState(lead.developmentId || "");
  const [developmentNameText, setDevelopmentNameText] = useState(
    lead.developmentNameText || (!lead.developmentId ? lead.developmentName || "" : "")
  );
  const [assignedAgentId, setAssignedAgentId] = useState(lead.assignedAgentId || "");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [copiedField, setCopiedField] = useState<"email" | "phone" | "">("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isPending, startTransition] = useTransition();
  const socialProfileUrl = socialProfileHref(socialProfile, lead.source);
  const linkedinProfileUrl = /^https:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/.+/i.test(linkedinProfile)
    ? linkedinProfile
    : "";
  const phoneLocality = getArgentinaPhoneLocality(countryCode, phone);
  const [initialLocation] = useState(() => getCrmContactLocation(lead.metaProperties));
  const [address, setAddress] = useState(initialLocation.address);
  const [locality, setLocality] = useState(initialLocation.locality);
  const [province, setProvince] = useState(initialLocation.province);
  const [country, setCountry] = useState(initialLocation.country || "");
  const [localityEdited, setLocalityEdited] = useState(false);
  const localitySuggestion = getArgentinaPhoneLocalitySuggestion(countryCode, phone) || "";
  const displayedLocality = localityEdited ? locality : locality || localitySuggestion;
  const [provinceEdited, setProvinceEdited] = useState(false);
  const [countryEdited, setCountryEdited] = useState(false);
  const provinceSuggestion = getArgentinaPhoneProvince(countryCode, phone) || "";
  const countrySuggestion = getPhoneCountryName(countryCode, phone) || "";
  const displayedProvince = provinceEdited ? province : province || provinceSuggestion;
  const displayedCountry = countryEdited ? country : country || countrySuggestion;

  const save = async (payload: {
    companyName?: string;
    country?: string;
    dni?: string;
    birthDate?: string;
    address?: string;
    locality?: string;
    province?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    occupation?: string;
    website?: string;
    countryCode?: string;
    phone?: string;
    socialProfile?: string;
    linkedinProfile?: string;
    status?: CrmLeadStatus;
    developmentId?: string;
    campaignName?: string;
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
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cambio");
      return false;
    }
  };

  const saveStatus = async (nextStatus: CrmLeadStatus) => {
    if (nextStatus === status || isSavingStatus) return;
    if (isMeetingStatus(nextStatus)) {
      setNotice("Agendá día y horario. El estado cambia solo cuando la reunión queda confirmada.");
      window.dispatchEvent(new CustomEvent("crm:open-meeting-scheduler", {detail:{moveToMeeting:true}}));
      return;
    }

    const previousStatus = status;
    setStatus(nextStatus);
    setIsSavingStatus(true);
    const saved = await save({ status: nextStatus });
    if (!saved) setStatus(previousStatus);
    setIsSavingStatus(false);
  };

  const copyContactField = async (field: "email" | "phone", value: string) => {
    const cleanValue = value.trim();
    if (!cleanValue) return;
    try {
      await navigator.clipboard.writeText(cleanValue);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(""), 1600);
    } catch {
      setError("No se pudo copiar el dato. Seleccionalo y copialo manualmente.");
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
          dni, birthDate, companyName, address, locality: displayedLocality, province: displayedProvince, country: displayedCountry,
          firstName,
          lastName,
          email,
          occupation,
          website,
          countryCode: normalizeDialCode(countryCode),
          phone,
          socialProfile,
          linkedinProfile,
          status,
          campaignName,
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
      className="min-w-0 rounded-xl border border-ink/12 bg-white p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Información del cliente</h2>
        </div>
        {(notice || isPending || isSavingStatus) && (
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-800">
            {isPending || isSavingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {isSavingStatus ? "Guardando estado" : notice || "Actualizando"}
          </span>
        )}
      </div>

      <div className="mt-3 grid min-w-0 gap-2.5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <div className="grid grid-cols-2 gap-2.5 sm:col-span-2 xl:col-span-1 2xl:col-span-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-ink/50">
              Nombre
            </span>
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="h-9 w-full min-w-0 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-ink/50">
              Apellido
            </span>
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="h-9 w-full min-w-0 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15"
            />
          </label>
        </div>

        <label className="block sm:col-span-2 xl:col-span-1 2xl:col-span-2">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-ink/60">Empresa</span>
          <input type="text" autoComplete="organization" maxLength={200} value={companyName} onChange={event => setCompanyName(event.target.value)} placeholder="Nombre de la empresa o comercio" className="h-9 w-full min-w-0 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15" />
        </label>

        <label className="block sm:col-span-2 xl:col-span-1 2xl:col-span-2">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-ink/60">Número de DNI</span>
          <input type="text" inputMode="numeric" maxLength={30} value={dni} onChange={event => setDni(event.target.value)} placeholder="Número de documento"
            className="h-9 w-full min-w-0 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15" />
        </label>

        <label className="block sm:col-span-2 xl:col-span-1 2xl:col-span-2">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-ink/60">Fecha de nacimiento</span>
          <input type="date" autoComplete="bday" min="0001-01-01" value={birthDate} onChange={event => setBirthDate(event.target.value)}
            className="h-9 w-full min-w-0 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15" />
        </label>

        <label className="block sm:col-span-2 xl:col-span-1 2xl:col-span-2">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-ink/60">Actividad</span>
          <select value={occupation} onChange={event => setOccupation(event.target.value)} className="h-9 w-full min-w-0 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15">
            <option value="">Seleccionar actividad</option>
            {occupation && !occupations.some(option => option.value === occupation) && <option value={occupation}>{occupation}</option>}
            {occupations.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>

        <label className="block sm:col-span-2 xl:col-span-1 2xl:col-span-2">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-ink/50">
            Correo
          </span>
          <div className="flex gap-2">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-9 min-w-0 flex-1 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15"
              type="email"
            />
            <button
              type="button"
              onClick={() => void copyContactField("email", email)}
              disabled={!email.trim()}
              aria-label={copiedField === "email" ? "Correo copiado" : "Copiar correo"}
              title={copiedField === "email" ? "Copiado" : "Copiar correo"}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink/14 bg-white text-[#006b6b] transition-colors hover:bg-[#e7f4f2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {copiedField === "email" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </label>

        <label className="block sm:col-span-2 xl:col-span-1 2xl:col-span-2">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-ink/60">Página web</span>
          <div className="flex gap-2"><input type="url" value={website} onChange={event => setWebsite(event.target.value)} maxLength={2048} placeholder="https://www.ejemplo.com" className="h-9 w-full min-w-0 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15" />
          {websiteHref && <a href={websiteHref} target="_blank" rel="noopener noreferrer" aria-label="Abrir página web" title="Abrir página web" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink/14 text-[#006b6b] hover:bg-[#e7f4f2]"><ExternalLink className="h-4 w-4" /></a>}</div>
        </label>

        <div className="block">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-ink/50">
              Perfil de LinkedIn
            </span>
            <span className="flex items-center gap-2">
              {linkedinProfileUrl && (
                <a href={linkedinProfileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#006b6b] hover:underline">
                  Abrir perfil <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <a
                href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${firstName} ${lastName}`.trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#006b6b] hover:underline"
              >
                Buscar <ExternalLink className="h-3 w-3" />
              </a>
            </span>
          </div>
          <input
            value={linkedinProfile}
            onChange={(event) => setLinkedinProfile(event.target.value)}
            className="h-9 w-full min-w-0 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15"
            placeholder="Pegá el enlace al perfil confirmado"
            inputMode="url"
          />
        </div>

        <label className="block">
          <span className="mb-1 flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-ink/50">
            Perfil en redes
            {socialProfileUrl && (
              <a
                href={socialProfileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 normal-case tracking-normal text-[#006b6b] hover:underline"
              >
                Abrir perfil <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </span>
          <input
            value={socialProfile}
            onChange={(event) => setSocialProfile(event.target.value)}
            className="h-9 w-full min-w-0 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15"
            placeholder="@usuario o enlace al perfil"
          />
        </label>

        <div className="grid min-w-0 grid-cols-[92px_minmax(0,1fr)] gap-2.5 sm:col-span-2 xl:col-span-1 2xl:col-span-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-ink/50">
              Prefijo
            </span>
            <select
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value)}
              className="h-9 w-full min-w-0 truncate rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15"
              required
            >
              {PHONE_COUNTRIES.map((country) => (
                <option key={`${country.iso2}-${country.dialCode}`} value={country.dialCode}>
                  {country.dialCode}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-ink/50">
              Teléfono
            </span>
            <div className="flex gap-2">
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="h-9 min-w-0 flex-1 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15"
              />
              <button
                type="button"
                onClick={() => void copyContactField("phone", `${normalizeDialCode(countryCode)}${phone}`)}
                disabled={!phone.trim()}
                aria-label={copiedField === "phone" ? "Teléfono copiado" : "Copiar teléfono"}
                title={copiedField === "phone" ? "Copiado" : "Copiar teléfono"}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink/14 bg-white text-[#006b6b] transition-colors hover:bg-[#e7f4f2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006b6b] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {copiedField === "phone" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            {phoneLocality && (
              <span className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md border border-[#006b6b]/25 bg-[#e7f4f2] px-2 py-1 text-xs font-semibold text-[#005c5c]" title={`Localidad estimada: ${phoneLocality}`}>
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#006b6b]" aria-hidden="true" />
                <span className="sr-only">Localidad estimada: </span>
                <span className="truncate">{phoneLocality}</span>
              </span>
            )}
          </label>
        </div>

        {([
          { label: "Dirección", value: address, setter: setAddress, maxLength: 500, placeholder: "Calle, número, piso y departamento", autocomplete: "street-address" },
          { label: "Provincia", value: displayedProvince, setter: (value: string) => { setProvince(value); setProvinceEdited(true); }, maxLength: 200, placeholder: "Ej. Córdoba", autocomplete: "address-level1" },
          { label: "País", value: displayedCountry, setter: (value: string) => { setCountry(value); setCountryEdited(true); }, maxLength: 200, placeholder: "Confirmar país", autocomplete: "country-name" },
          { label: "Localidad", value: displayedLocality, setter: (value: string) => { setLocality(value); setLocalityEdited(true); }, maxLength: 200, placeholder: "Ej. Villa Carlos Paz", autocomplete: "address-level2" },
        ]).map(field => <label key={field.label} className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-ink/50">{field.label}</span>
          <input value={field.value} onChange={event => field.setter(event.target.value)} maxLength={field.maxLength} autoComplete={field.autocomplete}
            list={field.label === "Provincia" ? `provinces-${lead.id}` : undefined} placeholder={field.placeholder}
            className="h-10 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink outline-none focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15" />
        </label>)}
        <datalist id={`provinces-${lead.id}`}>{ARGENTINA_PROVINCES.map(name => <option key={name} value={name} />)}</datalist>

        <label className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-ink/50">
            Estado del lead
          </span>
          <select
            value={status}
            disabled={isSavingStatus}
            onChange={(event) => void saveStatus(event.target.value as CrmLeadStatus)}
            className="h-9 w-full min-w-0 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15"
          >
            {leadStatusOptionsForValue(status).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2 xl:col-span-1 2xl:col-span-2">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-ink/50">
            Desarrollo
          </span>
          <select
            value={developmentId}
            onChange={(event) => {
              const nextDevelopmentId = event.target.value;
              setDevelopmentId(nextDevelopmentId);
              setDevelopmentNameText(developments.find(d => d.id === nextDevelopmentId)?.name || "");
              if (nextDevelopmentId.startsWith("text:")) {
                setDevelopmentNameText(
                  developments.find((development) => development.id === nextDevelopmentId)?.name ||
                    nextDevelopmentId.replace(/^text:/, "")
                );
              }
            }}
            className="h-9 w-full min-w-0 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15"
          >
            <option value="">{!developmentId && developmentNameText ? developmentNameText : "Sin desarrollo"}</option>
            {developments.map((development) => (
              <option key={development.id} value={development.id}>
                {development.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2 xl:col-span-1 2xl:col-span-2">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-ink/60">Campaña</span>
          <input value={campaignName} onChange={event => setCampaignName(event.target.value)} maxLength={500} placeholder="Ej. Campaña inversores" className="h-9 w-full min-w-0 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15" />
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-ink/50">
            Propietario del contacto
          </span>
          {canAssignOwner ? (
            <select
              value={assignedAgentId}
              onChange={(event) => setAssignedAgentId(event.target.value)}
              className="h-9 w-full min-w-0 rounded-lg border border-ink/14 bg-white px-3 text-sm font-medium text-ink outline-none transition-colors focus:border-[#006b6b] focus:ring-2 focus:ring-[#006b6b]/15"
            >
              <option value="">Sin asignar</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name || agent.email}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex h-9 w-full items-center rounded-lg border border-ink/12 bg-cream-100 px-3 text-sm font-medium text-ink">
              {lead.assignedAgentName || "Sin asignar"}
            </div>
          )}
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
        className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-bone transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Guardar información
      </button>

      {canDelete && (
        <div className="mt-3 border-t border-ink/10 pt-3">
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
