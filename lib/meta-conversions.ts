import { createHash } from "crypto";
import type { CrmLead } from "@/lib/db";

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v26.0";
const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

type MetaErrorPayload = { error?: { message?: string; code?: number } };
let datasetIdPromise: Promise<string> | null = null;

export type MetaQualifiedLeadResult = {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  eventId?: string;
  datasetId?: string;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedText(value?: string) {
  return (value || "").trim().toLowerCase();
}

function normalizedPhone(lead: CrmLead) {
  return `${lead.countryCode || ""}${lead.phone || ""}`.replace(/\D/g, "");
}

async function metaJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("Falta configurar META_ACCESS_TOKEN.");
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${META_GRAPH_BASE_URL}/${path}${separator}access_token=${encodeURIComponent(token)}`, {
    ...init,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as (T & MetaErrorPayload) | null;
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || `Meta respondió ${response.status}`);
  }
  return payload as T;
}

async function resolveAdAccountId() {
  const configured = process.env.META_AD_ACCOUNT_ID?.trim();
  if (configured) return configured.startsWith("act_") ? configured : `act_${configured}`;
  const accounts = await metaJson<{ data?: Array<{ id: string }> }>("me/adaccounts?fields=id&limit=1");
  const id = accounts.data?.[0]?.id;
  if (!id) throw new Error("El token de Meta no tiene una cuenta publicitaria disponible.");
  return id;
}

async function findDatasetId() {
  const configured = (process.env.META_DATASET_ID || process.env.META_PIXEL_ID)?.trim();
  if (configured) return configured;

  const accountId = await resolveAdAccountId();
  const pixels = await metaJson<{ data?: Array<{ id: string; name?: string; is_unavailable?: boolean }> }>(
    `${accountId}/adspixels?fields=id,name,is_unavailable&limit=100`
  );
  const available = (pixels.data || []).filter((pixel) => pixel.id && !pixel.is_unavailable);
  const preferred = available.find((pixel) => /crm|barrera/i.test(pixel.name || "")) || available[0];
  if (!preferred?.id) {
    throw new Error("No encontré un conjunto de datos de Meta habilitado para Conversions API.");
  }
  return preferred.id;
}

async function resolveDatasetId() {
  if (!datasetIdPromise) {
    datasetIdPromise = findDatasetId().catch((error) => {
      datasetIdPromise = null;
      throw error;
    });
  }
  return datasetIdPromise;
}

export function isInterestedLeadStatus(status?: string) {
  return normalizedText(status) === "interesado";
}

export async function sendMetaQualifiedLead(lead: CrmLead): Promise<MetaQualifiedLeadResult> {
  const leadId = String(lead.metaLeadId || lead.metaProperties?.meta_lead_id || "").trim();
  if (!leadId) {
    return { sent: false, skipped: true, reason: "El contacto no proviene de un formulario de Meta." };
  }

  const datasetId = await resolveDatasetId();
  const eventId = `bb-crm-qualified-${lead.id}`;
  const email = normalizedText(lead.email);
  const phone = normalizedPhone(lead);
  const firstName = normalizedText(lead.firstName);
  const lastName = normalizedText(lead.lastName);
  const userData: Record<string, string | string[]> = { lead_id: leadId };
  if (email) userData.em = [sha256(email)];
  if (phone) userData.ph = [sha256(phone)];
  if (firstName) userData.fn = [sha256(firstName)];
  if (lastName && lastName !== "-") userData.ln = [sha256(lastName)];
  userData.external_id = [sha256(lead.id)];

  await metaJson<{ events_received?: number; messages?: string[] }>(`${datasetId}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [{
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "system_generated",
        user_data: userData,
        custom_data: {
          event_source: "crm",
          lead_event_source: "Barrera Brokers CRM",
          lead_status: "Qualified",
        },
      }],
    }),
  });

  return { sent: true, eventId, datasetId };
}
