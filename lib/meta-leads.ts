import { createHmac, timingSafeEqual } from "crypto";
import { getDevelopments } from "@/lib/developments-db";
import {
  createCrmActivity,
  getAllAgents,
  upsertCrmLeadByEmail,
  type CrmHubSpotProperties,
} from "@/lib/db";
import { splitInternationalPhone } from "@/lib/phone-countries";
import { recordMetaLeadsSync } from "@/lib/meta-sync-state";

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
  const answers = Object.fromEntries(Array.from(fields.entries()));
  const submission = {
    leadId: lead.id,
    formId: lead.form_id || null,
    formName: formName || "",
    createdTime: lead.created_time || null,
    fields: answers,
  };
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
    meta_submissions: JSON.stringify([submission]),
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

  const campaignAliases: Array<{ patterns: string[]; names: string[] }> = [
    { patterns: ["alpha place libertador", "formulario libertador"], names: ["Alpha Place Libertador"] },
    { patterns: ["alpha place belgrano"], names: ["Alpha Place Belgrano", "Alpha Place Belgrano German"] },
    { patterns: ["juan b justo", "juan b. justo"], names: ["Juan B Justo"] },
    { patterns: ["feel recoleta"], names: ["Feel Recoleta"] },
    { patterns: ["feel palermo"], names: ["Feel Palermo", "Feel Palermo G&D"] },
    { patterns: ["obelisco"], names: ["Obelisco"] },
  ];
  for (const alias of campaignAliases) {
    if (!alias.patterns.some((pattern) => haystack.includes(normalizeSearch(pattern)))) continue;
    const matched = developments.find((development) =>
      alias.names.some((name) => normalizeSearch(development.name) === normalizeSearch(name))
    );
    if (matched) return { id: matched.id, name: matched.name };
  }

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
  const auditAgentId = await defaultAssignedAgentId();
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
    assignedAgentId: undefined,
    notes: "",
    metaLeadId: lead.id,
    metaFormId: lead.form_id || options?.webhookValue?.form_id,
    metaPageId: lead.page_id || options?.webhookValue?.page_id,
    metaProperties: metaProperties(lead, fields, formName),
    createdBy: options?.createdBy || auditAgentId,
  }, { preserveExistingValues: true, preservePopulatedFields: true, leaveUnassignedOnCreate: true });

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
    createdBy: options?.createdBy || auditAgentId,
    externalSource: "meta_lead_ads",
    externalId: lead.id,
  });

  return {
    created: result.created,
    leadId: result.lead.id,
    email,
  };
}

const DEFAULT_META_FORM_IDS = [
  "858044513215666",
  "1456527069869122",
  "1108265682151952",
];

export async function backfillRecentMetaLeads(days = 3, createdBy?: string | null) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("Falta META_ACCESS_TOKEN en las variables de entorno.");
  const configured = (process.env.META_LEAD_FORM_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const formIds = configured.length > 0 ? configured : DEFAULT_META_FORM_IDS;
  const since = Date.now() - Math.max(1, Math.min(days, 30)) * 24 * 60 * 60 * 1000;
  const leadIds = new Set<string>();

  for (const formId of formIds) {
    let url = `${META_GRAPH_BASE_URL}/${formId}/leads?fields=id,created_time&limit=100&access_token=${encodeURIComponent(token)}`;
    for (let page = 0; page < 20 && url; page += 1) {
      const response = await fetch(url, { cache: "no-store" });
      const payload = await response.json() as {
        data?: Array<{ id?: string; created_time?: string }>;
        paging?: { next?: string };
        error?: { message?: string };
      };
      if (!response.ok || payload.error) throw new Error(payload.error?.message || `Meta respondió ${response.status}`);
      const entries = payload.data || [];
      for (const entry of entries) {
        if (entry.id && (!entry.created_time || new Date(entry.created_time).getTime() >= since)) leadIds.add(entry.id);
      }
      const oldest = entries.at(-1)?.created_time;
      if (!payload.paging?.next || (oldest && new Date(oldest).getTime() < since)) break;
      url = payload.paging.next;
    }
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ leadId: string; error: string }> = [];
  for (const leadId of Array.from(leadIds)) {
    try {
      const result = await importMetaLeadgenId(leadId, { createdBy });
      if (result.skipped) skipped += 1;
      else if (result.created) created += 1;
      else updated += 1;
    } catch (error) {
      errors.push({ leadId, error: error instanceof Error ? error.message : "No se pudo importar" });
    }
  }
  const summary = { forms: formIds.length, found: leadIds.size, created, updated, skipped, errors };
  const lastLeadSyncAt = await recordMetaLeadsSync({
    ...summary,
    errors: errors.length,
  });
  return { ...summary, lastLeadSyncAt };
}
