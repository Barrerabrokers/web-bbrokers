import { createHmac, timingSafeEqual } from "crypto";
import { getDevelopments } from "@/lib/developments-db";
import {
  createCrmActivity,
  getAllAgents,
  upsertCrmLeadByEmail,
  type CrmHubSpotProperties,
} from "@/lib/db";
import { splitInternationalPhone } from "@/lib/phone-countries";

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v26.0";
const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const DEFAULT_PABLO_EMAIL = "pablo@barrerabrokers.com";

type MetaFieldData = {
  name?: string;
  values?: string[];
};

type MetaLeadResponse = {
  id: string;
  created_time?: string;
  field_data?: MetaFieldData[];
  form_id?: string;
  page_id?: string;
  ad_id?: string;
  ad_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  platform?: string;
};

type MetaDevelopmentMatch = {
  id?: string;
  name: string;
};

export type MetaLeadWebhookValue = {
  leadgen_id?: string;
  form_id?: string;
  page_id?: string;
  ad_id?: string;
  created_time?: number;
};

type ImportedMetaLead = {
  created: boolean;
  leadId?: string;
  email?: string;
  skipped?: boolean;
  reason?: string;
};

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeSearch(value: string) {
  return normalizeKey(value).replace(/_/g, " ");
}

function fieldMap(fields: MetaFieldData[] = []) {
  const result = new Map<string, string>();
  for (const field of fields) {
    if (!field.name) continue;
    const value = field.values?.filter(Boolean).join(", ").trim() || "";
    if (!value) continue;
    result.set(normalizeKey(field.name), value);
  }
  return result;
}

function getMappedValue(fields: Map<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = fields.get(normalizeKey(key));
    if (value) return value;
  }
  return "";
}

function splitName(rawName: string, email: string) {
  const cleanName = rawName.trim();
  if (!cleanName) {
    return {
      firstName: email.split("@")[0] || "Contacto",
      lastName: "-",
    };
  }

  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: "-" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.slice(-1).join(" "),
  };
}

function splitPhone(rawPhone: string) {
  return splitInternationalPhone(rawPhone);
}

function metaProperties(
  lead: MetaLeadResponse,
  fields: Map<string, string>,
  formName = ""
): CrmHubSpotProperties {
  const properties: CrmHubSpotProperties = {
    meta_lead_id: lead.id,
    meta_form_id: lead.form_id || null,
    meta_page_id: lead.page_id || null,
    meta_ad_id: lead.ad_id || null,
    meta_ad_name: lead.ad_name || null,
    meta_campaign_id: lead.campaign_id || null,
    meta_campaign_name: lead.campaign_name || null,
    meta_platform: lead.platform || null,
    meta_created_time: lead.created_time || null,
    meta_form_name: formName || null,
  };

  for (const [key, value] of Array.from(fields.entries())) {
    properties[`meta_field_${key}`] = value;
  }

  return properties;
}

async function metaFetchFormName(formId?: string) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token || !formId) return "";

  try {
    const response = await fetch(
      `${META_GRAPH_BASE_URL}/${encodeURIComponent(formId)}?fields=id,name&access_token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    if (!response.ok) return "";
    const form = (await response.json()) as { name?: string };
    return form.name?.trim() || "";
  } catch {
    return "";
  }
}

async function metaFetchLead(leadgenId: string) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Falta META_ACCESS_TOKEN en las variables de entorno.");
  }

  const fields = [
    "id",
    "created_time",
    "field_data",
    "form_id",
    "ad_id",
    "ad_name",
    "campaign_id",
    "campaign_name",
    "platform",
  ].join(",");

  const response = await fetch(
    `${META_GRAPH_BASE_URL}/${encodeURIComponent(leadgenId)}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`,
    { cache: "no-store" }
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Meta ${response.status}: ${text || response.statusText}`);
  }

  return JSON.parse(text) as MetaLeadResponse;
}

async function defaultAssignedAgentId() {
  const agentEmail = (
    process.env.META_DEFAULT_AGENT_EMAIL ||
    process.env.CRM_PABLO_AGENT_EMAIL ||
    process.env.HUBSPOT_OWNER_EMAIL ||
    DEFAULT_PABLO_EMAIL
  ).toLowerCase();

  const agents = await getAllAgents();
  const agent =
    agents.find((item) => item.email.toLowerCase() === agentEmail) ||
    agents.find((item) => item.name.toLowerCase().includes("pablo barrera")) ||
    agents.find((item) => item.role === "admin");

  if (!agent?.id) {
    throw new Error("No encontré un agente activo para asignar los contactos de Meta.");
  }

  return agent.id;
}

function inferredDevelopmentText(fields: Map<string, string>) {
  for (const [key, value] of Array.from(fields.entries())) {
    if (/desarrollo|emprendimiento|proyecto|interesa_invertir/.test(key) && value.trim()) {
      return value.replaceAll("_", " ").replace(/\s+/g, " ").trim();
    }
  }
  return "";
}

async function matchDevelopment(
  lead: MetaLeadResponse,
  fields: Map<string, string>,
  formName = ""
): Promise<MetaDevelopmentMatch | undefined> {
  const developments = await getDevelopments();
  if (developments.length === 0) return undefined;

  const haystack = normalizeSearch(
    [
      lead.ad_name,
      lead.campaign_name,
      formName,
      lead.form_id,
      lead.page_id,
      ...Array.from(fields.values()),
    ]
      .filter(Boolean)
      .join(" ")
  );

  const exactMatch = developments.find((development) => {
    const name = normalizeSearch(development.name);
    const slug = normalizeSearch(development.slug);
    return haystack.includes(name) || haystack.includes(slug);
  });
  if (exactMatch) return { id: exactMatch.id, name: exactMatch.name };

  const genericWords = new Set(["alpha", "place", "feel", "point", "estudios"]);
  const partialMatches = developments.filter((development) => {
    const distinctiveWords = normalizeSearch(`${development.name} ${development.slug}`)
      .split(" ")
      .filter((word) => word.length >= 5 && !genericWords.has(word));
    return distinctiveWords.some((word) => haystack.includes(word));
  });

  if (partialMatches.length === 1) {
    return { id: partialMatches[0].id, name: partialMatches[0].name };
  }

  const inferred = inferredDevelopmentText(fields);
  return inferred ? { name: inferred } : undefined;
}

export function verifyMetaSignature(rawBody: string, signatureHeader: string | null) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return false;
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  const received = signatureHeader.replace("sha256=", "");

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function importMetaLeadgenId(
  leadgenId: string,
  options?: {
    createdBy?: string | null;
    webhookValue?: MetaLeadWebhookValue;
  }
): Promise<ImportedMetaLead> {
  const lead = await metaFetchLead(leadgenId);
  const fields = fieldMap(lead.field_data);
  const email = getMappedValue(fields, [
    "email",
    "correo",
    "correo_electronico",
    "mail",
    "e_mail",
  ])
    .trim()
    .toLowerCase();

  if (!email) {
    return {
      created: false,
      skipped: true,
      reason: "Meta no envió un email para este lead.",
    };
  }

  const rawPhone = getMappedValue(fields, [
    "phone_number",
    "phone",
    "telefono",
    "teléfono",
    "celular",
    "whatsapp",
  ]);
  const rawFullName = getMappedValue(fields, [
    "full_name",
    "full name",
    "nombre_y_apellido",
    "nombre completo",
    "name",
  ]);
  const firstNameField = getMappedValue(fields, ["first_name", "firstname", "nombre"]);
  const lastNameField = getMappedValue(fields, ["last_name", "lastname", "apellido"]);
  const name = splitName(rawFullName, email);
  const phone = splitPhone(rawPhone);
  const assignedAgentId = await defaultAssignedAgentId();
  const formName = await metaFetchFormName(lead.form_id || options?.webhookValue?.form_id);
  const development = await matchDevelopment(lead, fields, formName);

  const result = await upsertCrmLeadByEmail({
    firstName: firstNameField || name.firstName,
    lastName: lastNameField || name.lastName,
    email,
    countryCode: phone.countryCode,
    phone: phone.phone || rawPhone || "-",
    status: "NEW",
    source: "Meta Lead Ads",
    developmentId: development?.id,
    developmentNameText: development?.name || "",
    assignedAgentId,
    notes: "",
    metaLeadId: lead.id,
    metaFormId: lead.form_id || options?.webhookValue?.form_id,
    metaPageId: lead.page_id || options?.webhookValue?.page_id,
    metaProperties: metaProperties(lead, fields, formName),
    createdBy: options?.createdBy || assignedAgentId,
  }, { preserveExistingValues: true, preservePopulatedFields: true });

  if (!result.lead) {
    throw new Error(result.error || "No se pudo guardar el contacto de Meta.");
  }

  await createCrmActivity({
    leadId: result.lead.id,
    type: "nota",
    title: result.created ? "Lead recibido desde Meta" : "Lead actualizado desde Meta",
    body: [
      lead.ad_name ? `Anuncio: ${lead.ad_name}` : "",
      lead.campaign_name ? `Campaña: ${lead.campaign_name}` : "",
      lead.form_id ? `Formulario Meta: ${lead.form_id}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    createdBy: options?.createdBy || assignedAgentId,
    externalSource: "meta_lead_ads",
    externalId: lead.id,
  });

  return {
    created: result.created,
    leadId: result.lead.id,
    email,
  };
}
