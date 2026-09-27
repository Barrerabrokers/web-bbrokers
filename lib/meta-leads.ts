import { createHmac, timingSafeEqual } from "crypto";
import postgres from "postgres";
import { getDevelopments } from "@/lib/developments-db";
import {
  createCrmActivity,
  getAllAgents,
  notifyCrmCampaignRecontact,
  upsertCrmLeadByEmail,
  type CrmHubSpotProperties,
} from "@/lib/db";
import { splitInternationalPhone } from "@/lib/phone-countries";
import { recordMetaLeadsSync } from "@/lib/meta-sync-state";
import { socialConnectionStore } from "@/lib/meta-social-store";
import { getMetaCrmAppId, getMetaCrmAppSecret } from "@/lib/meta-app-config";
import { getExcludedMetaRecoveryFormIds } from "@/lib/meta-lead-recovery-policy";

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

export async function metaLeadConnection() {
  const stored = await socialConnectionStore().catch(() => null);
  const connected = stored?.appId === getMetaCrmAppId() ? stored : null;
  const systemToken = process.env.META_CRM_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
  // Legacy connections were authorized only for Instagram. They must not
  // displace the working Lead Ads token before CRM OAuth has been renewed.
  const useRenewedConnection = Boolean(connected?.userToken);
  return {
    token: (useRenewedConnection ? connected?.token : systemToken) || connected?.token || "",
    pageId: useRenewedConnection || !systemToken ? connected?.pageId : undefined,
    userToken: connected?.userToken,
  };
}

async function metaLeadAccessToken() {
  return (await metaLeadConnection()).token;
}

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

function getPhoneValue(fields: Map<string, string>) {
  const mapped = getMappedValue(fields, [
    "phone_number",
    "phone",
    "telefono",
    "teléfono",
    "numero_de_telefono",
    "número_de_teléfono",
    "numero de telefono",
    "número de teléfono",
    "celular",
    "whatsapp",
  ]);
  if (mapped) return mapped;

  // Meta preserves the field label chosen in each instant form. Accept custom
  // labels such as "Número de teléfono" without treating unrelated answers as
  // a phone number.
  for (const [key, value] of fields) {
    if (/(^|_)(phone|telefono|celular|whatsapp)(_|$)/.test(key)) return value;
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

export type MetaImportContext = {
  token: string;
  formNames: Map<string, string>;
  developments: Array<{ id: string; name: string; slug: string }>;
  auditAgentId: string;
};

function metaReadDb() {
  const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Falta la conexión de datos del CRM.");
  return postgres(url, { ssl: "require", prepare: false, max: 1, connect_timeout: 10, connection: { statement_timeout: 15000 }, onnotice() {} });
}

export async function createMetaImportContext(token: string, formNames: Map<string, string>): Promise<MetaImportContext> {
  const sql = metaReadDb();
  try {
    // Matching only needs these three fields, not images, brochures or videos.
    const developments = await sql`SELECT id,name,slug FROM developments`;
    return { token, formNames, developments: developments as unknown as MetaImportContext["developments"], auditAgentId: await defaultAssignedAgentId() };
  } finally { await sql.end(); }
}

export async function getKnownMetaFormIds() {
  const sql = metaReadDb();
  try {
    const rows = await sql`SELECT DISTINCT meta_form_id AS id FROM crm_leads WHERE meta_form_id ~ '^[0-9]+$' LIMIT 500`;
    return rows.map(row => String(row.id));
  } finally { await sql.end(); }
}

export async function findProcessedMetaLeadIds(ids: string[]) {
  if (!ids.length) return new Set<string>();
  const sql = metaReadDb();
  try {
    const rows = await sql`SELECT a.external_id FROM crm_activities a JOIN crm_leads l ON l.id=a.lead_id
      WHERE a.external_source='meta_lead_ads' AND a.external_id=ANY(${ids}::text[])`;
    return new Set(rows.map(row => String(row.external_id)));
  } finally { await sql.end(); }
}

async function metaFetchFormName(formId?: string, context?: MetaImportContext) {
  if (formId && context?.formNames.has(formId)) return context.formNames.get(formId)!;
  const token = context?.token || await metaLeadAccessToken();
  if (!token || !formId) return "";

  try {
    const response = await fetch(
      `${META_GRAPH_BASE_URL}/${encodeURIComponent(formId)}?fields=id,name&access_token=${encodeURIComponent(token)}`,
      { cache: "no-store", signal: AbortSignal.timeout(15000) }
    );
    if (!response.ok) return "";
    const form = (await response.json()) as { name?: string };
    const name = form.name?.trim() || "";
    context?.formNames.set(formId, name);
    return name;
  } catch {
    return "";
  }
}

async function metaFetchLead(leadgenId: string, context?: MetaImportContext) {
  const token = context?.token || await metaLeadAccessToken();
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
    { cache: "no-store", signal: AbortSignal.timeout(15000) }
  );

  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error || !data?.id) throw new Error(`Meta no pudo leer el lead (HTTP ${response.status}, código ${Number(data?.error?.code) || 0}).`);
  return data as MetaLeadResponse;
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
  formName = "",
  context?: MetaImportContext,
): Promise<MetaDevelopmentMatch | undefined> {
  const developments = context?.developments || await getDevelopments();
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
    { patterns: ["feel recoleta", "formulario recoleta"], names: ["Feel Recoleta"] },
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
  const appSecret = getMetaCrmAppSecret();
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
    context?: MetaImportContext;
  }
): Promise<ImportedMetaLead> {
  const lead = await metaFetchLead(leadgenId, options?.context);
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

  const rawPhone = getPhoneValue(fields);
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
  const auditAgentId = options?.context?.auditAgentId || await defaultAssignedAgentId();
  const formName = await metaFetchFormName(lead.form_id || options?.webhookValue?.form_id, options?.context);
  const development = await matchDevelopment(lead, fields, formName, options?.context);

  const result = await upsertCrmLeadByEmail({
    firstName: firstNameField || name.firstName,
    lastName: lastNameField || name.lastName,
    email,
    countryCode: phone.countryCode,
    phone: phone.phone || rawPhone || "-",
    status: "Nuevo",
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

  // The source activity is the recovery completion marker. Persist the owner
  // notification first; its unique event key makes a crash/retry safe.
  if (!result.created) {
    const notification = await notifyCrmCampaignRecontact({
      leadId: result.lead.id,
      campaignLeadId: lead.id,
      campaignName: lead.campaign_name,
      formName,
    });
    if (notification?.error) throw new Error("El contacto se guardó, pero falta avisar al propietario. Se reintentará sin duplicarlo.");
  }

  const activityResult = await createCrmActivity({
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
  if (activityResult?.error) throw new Error("El contacto se guardó, pero falta registrar su consulta de Meta. Se reintentará sin duplicarlo.");

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

type MetaCollection<T> = {
  data?: T[];
  paging?: { next?: string };
  error?: { code?: number; error_subcode?: number };
};

async function metaCollection<T>(url: string): Promise<MetaCollection<T>> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  const payload = await response.json().catch(() => null) as MetaCollection<T> | null;
  if (!response.ok || payload?.error || !Array.isArray(payload?.data)) {
    // Meta errors can contain request details. Report identifiers, not tokens or payloads.
    const code = payload?.error?.code;
    throw new Error(`No se pudo consultar Meta (HTTP ${response.status}${code ? `, código ${code}` : ""}).`);
  }
  return payload;
}

async function fetchMetaLeadFormIds(pageId: string, token: string) {
  const ids = new Set<string>();
  let url = `${META_GRAPH_BASE_URL}/${encodeURIComponent(pageId)}/leadgen_forms?fields=id&limit=100&access_token=${encodeURIComponent(token)}`;

  try {
    for (let page = 0; page < 10 && url; page += 1) {
      const payload = await metaCollection<{ id?: string }>(url);
      for (const form of payload.data || []) {
        if (form.id) ids.add(form.id);
      }
      url = payload.paging?.next || "";
    }
    return { ids, error: url ? "Se alcanzó el límite de páginas de formularios; la consulta quedó incompleta." : undefined };
  } catch (error) {
    return { ids, error: error instanceof Error ? error.message : "No se pudieron consultar los formularios." };
  }
}

async function discoverMetaLeadFormIds(connection: Awaited<ReturnType<typeof metaLeadConnection>>) {
  const { token } = connection;
  const pageIds = new Set(
    [
      connection.pageId || process.env.META_CRM_PAGE_ID || process.env.META_PAGE_ID || process.env.META_SOCIAL_PAGE_ID || process.env.FACEBOOK_PAGE_ID,
    ]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
  );
  const errors: Array<{ pageId?: string; error: string }> = [];

  // A connected Page can discover its own forms directly. Only use /me/accounts
  // with an explicit user token when there is no configured Page to query.
  if (pageIds.size === 0 && connection.userToken) {
    let url = `${META_GRAPH_BASE_URL}/me/accounts?fields=id&limit=100&access_token=${encodeURIComponent(connection.userToken)}`;
    try {
      for (let page = 0; page < 10 && url; page += 1) {
        const payload = await metaCollection<{ id?: string }>(url);
        for (const item of payload.data || []) {
          if (item.id) pageIds.add(item.id);
        }
        url = payload.paging?.next || "";
      }
      if (url) errors.push({ error: "Se alcanzó el límite de páginas de Meta; el descubrimiento quedó incompleto." });
    } catch (error) {
      errors.push({ error: error instanceof Error ? error.message : "No se pudieron consultar las páginas de Meta." });
    }
  }

  const formIds = new Set<string>();
  if (pageIds.size === 0) errors.push({ error: "Falta conectar o configurar la página del CRM para descubrir sus formularios." });
  for (const pageId of pageIds) {
    const result = await fetchMetaLeadFormIds(pageId, token);
    for (const id of result.ids) formIds.add(id);
    if (result.error) errors.push({ pageId, error: result.error });
  }
  return { formIds, errors };
}

export async function backfillRecentMetaLeads(days = 3, createdBy?: string | null) {
  const connection = await metaLeadConnection();
  const { token } = connection;
  if (!token) throw new Error("Falta META_ACCESS_TOKEN en las variables de entorno.");
  const configured = (process.env.META_LEAD_FORM_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const discovered = await discoverMetaLeadFormIds(connection);
  const excludedForms = getExcludedMetaRecoveryFormIds();
  const formIds = Array.from(new Set([
    ...DEFAULT_META_FORM_IDS,
    ...configured,
    ...discovered.formIds,
  ])).filter(id => !excludedForms.has(id));
  const since = Date.now() - Math.max(1, Math.min(days, 30)) * 24 * 60 * 60 * 1000;
  const leadIds = new Set<string>();
  const formErrors: Array<{ formId: string; error: string }> = [];
  let formsSucceeded = 0;

  for (const formId of formIds) {
    let url = `${META_GRAPH_BASE_URL}/${formId}/leads?fields=id,created_time&limit=100&access_token=${encodeURIComponent(token)}`;
    try {
      for (let page = 0; page < 20 && url; page += 1) {
        const payload = await metaCollection<{ id?: string; created_time?: string }>(url);
        const entries = payload.data || [];
        for (const entry of entries) {
          if (entry.id && (!entry.created_time || new Date(entry.created_time).getTime() >= since)) leadIds.add(entry.id);
        }
        const oldest = entries.at(-1)?.created_time;
        url = oldest && new Date(oldest).getTime() < since ? "" : payload.paging?.next || "";
      }
      if (url) formErrors.push({ formId, error: "Se alcanzó el límite de páginas de consultas; la recuperación quedó incompleta." });
      else formsSucceeded += 1;
    } catch (error) {
      formErrors.push({ formId, error: error instanceof Error ? error.message : "No se pudieron recuperar las consultas del formulario." });
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
  const complete = errors.length === 0 && formErrors.length === 0 && discovered.errors.length === 0 && skipped === 0;
  const status = complete ? "complete" : formsSucceeded === 0 && created + updated === 0 ? "failed" : "partial";
  const warnings = [
    ...discovered.errors.map((error) => `Formularios${error.pageId ? ` de la página ${error.pageId}` : ""}: ${error.error}`),
    ...formErrors.map((error) => `Formulario ${error.formId}: ${error.error}`),
    ...(skipped ? [`${skipped} consultas no pudieron importarse porque no incluyen correo electrónico.`] : []),
  ];
  const summary = {
    status, complete, forms: formIds.length, formsSucceeded, discoveredForms: [...discovered.formIds].filter(id => !excludedForms.has(id)).length,
    found: leadIds.size, created, updated, skipped, errors,
    discoveryErrors: discovered.errors, formErrors, warnings,
  };
  const lastLeadSyncAt = await recordMetaLeadsSync({
    ...summary,
    errors: errors.length,
    discoveryErrorCount: discovered.errors.length,
    formErrorCount: formErrors.length,
  }, complete);
  return { ...summary, lastLeadSyncAt };
}
