import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createCrmActivity,
  getAllAgents,
  getCrmDataProperties,
  getCrmLeads,
  upsertCrmLeadFromHubSpot,
  type CrmActivityType,
  type CrmDataProperty,
  type CrmLeadStatus,
} from "@/lib/db";
import { isCrmLeadStatus } from "@/lib/crm-statuses";
import { HUBSPOT_LEAD_STATUS_OPTIONS } from "@/lib/crm-statuses";
import { getDevelopments } from "@/lib/developments-db";
import { canManageAdminPanel, canViewAllCrmContacts } from "@/lib/roles";
import { splitInternationalPhone } from "@/lib/phone-countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type HubSpotOwner = {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

type HubSpotPropertyDefinition = {
  name: string;
};

type HubSpotContact = {
  id: string;
  properties?: Record<string, string | null>;
};

type CrmAgentRecord = Awaited<ReturnType<typeof getAllAgents>>[number];

type HubSpotSearchResponse = {
  results?: HubSpotContact[];
  paging?: {
    next?: {
      after?: string;
    };
  };
};

type HubSpotAssociationResponse = {
  results?: Array<{
    toObjectId?: number;
  }>;
};

type HubSpotBatchReadResponse = {
  results?: Array<{
    id: string;
    properties?: Record<string, string | null>;
    createdAt?: string;
    updatedAt?: string;
  }>;
};

const HUBSPOT_BASE_URL = "https://api.hubapi.com";
const DEFAULT_PABLO_EMAIL = "pablo@barrerabrokers.com";
const HUBSPOT_IMPORT_BATCH_SIZE = 50;
const MAX_ACTIVITIES_PER_TYPE_PER_CONTACT = Number(process.env.HUBSPOT_IMPORT_ACTIVITIES_PER_TYPE || 10);
const MAX_ACTIVITY_CONTACTS_PER_IMPORT = Number(process.env.HUBSPOT_IMPORT_ACTIVITY_CONTACTS || 25);
const FALLBACK_PROPERTIES = [
  "firstname",
  "lastname",
  "email",
  "phone",
  "mobilephone",
  "hs_lead_status",
  "lifecyclestage",
  "hubspot_owner_id",
  "createdate",
  "lastmodifieddate",
  "company",
  "city",
  "country",
  "hs_calculated_phone_number_country_code",
  "hs_calculated_phone_number",
  "hs_searchable_calculated_international_phone_number",
  "hs_whatsapp_phone_number",
  "desarrollo",
  "desarrollo_que_consulto",
  "desarrollo_que_consult",
  "proyecto",
  "first_conversion_event_name",
  "recent_conversion_event_name",
  "hs_latest_source_data_1",
  "hs_latest_source_data_2",
  "hs_analytics_first_url",
  "hs_analytics_last_url",
];

const USEFUL_PROPERTY_PATTERN =
  /desarrollo|proyecto|project|campaign|campana|campaña|form|conversion|source|url|whatsapp|phone|owner|lead|lifecycle|createdate|modified|email|name|country|city/i;
const MAX_HUBSPOT_SEARCH_PROPERTIES = 95;

const HUBSPOT_ACTIVITY_TYPES: Array<{
  objectType: string;
  crmType: CrmActivityType;
  title: string;
  properties: string[];
}> = [
  {
    objectType: "notes",
    crmType: "nota",
    title: "Nota de HubSpot",
    properties: ["hs_note_body", "hs_timestamp", "hubspot_owner_id"],
  },
  {
    objectType: "calls",
    crmType: "llamada",
    title: "Llamada de HubSpot",
    properties: [
      "hs_call_title",
      "hs_call_body",
      "hs_call_status",
      "hs_call_duration",
      "hs_call_from_number",
      "hs_call_to_number",
      "hs_timestamp",
      "hubspot_owner_id",
    ],
  },
  {
    objectType: "meetings",
    crmType: "reunion",
    title: "Reunión de HubSpot",
    properties: [
      "hs_meeting_title",
      "hs_meeting_body",
      "hs_meeting_start_time",
      "hs_meeting_end_time",
      "hs_timestamp",
      "hubspot_owner_id",
    ],
  },
  {
    objectType: "emails",
    crmType: "correo",
    title: "Correo de HubSpot",
    properties: [
      "hs_email_subject",
      "hs_email_text",
      "hs_email_html",
      "hs_email_from_email",
      "hs_email_to_email",
      "hs_timestamp",
      "hubspot_owner_id",
    ],
  },
  {
    objectType: "communications",
    crmType: "whatsapp",
    title: "Comunicación de HubSpot",
    properties: [
      "hs_communication_body",
      "hs_communication_channel_type",
      "hs_communication_logged_from",
      "hs_communication_logged_to",
      "hs_timestamp",
      "hubspot_owner_id",
    ],
  },
  {
    objectType: "tasks",
    crmType: "tarea",
    title: "Tarea de HubSpot",
    properties: [
      "hs_task_subject",
      "hs_task_body",
      "hs_task_status",
      "hs_task_priority",
      "hs_timestamp",
      "hubspot_owner_id",
    ],
  },
];

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function hubspotFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${HUBSPOT_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...headers(token),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HubSpot ${response.status}: ${text || response.statusText}`);
  }

  return (text ? JSON.parse(text) : {}) as T;
}

async function getPabloHubSpotOwnerId(token: string) {
  if (process.env.HUBSPOT_PABLO_OWNER_ID) {
    return process.env.HUBSPOT_PABLO_OWNER_ID;
  }

  const ownerEmail = process.env.HUBSPOT_OWNER_EMAIL || DEFAULT_PABLO_EMAIL;
  const data = await hubspotFetch<{ results?: HubSpotOwner[] }>(
    `/crm/v3/owners/?email=${encodeURIComponent(ownerEmail)}&archived=false`,
    token
  );
  const owner = data.results?.[0];
  if (!owner?.id) {
    throw new Error(`No encontré en HubSpot un owner con el email ${ownerEmail}`);
  }
  return owner.id;
}

async function getPabloAgentId() {
  const agentEmail = (process.env.CRM_PABLO_AGENT_EMAIL || process.env.HUBSPOT_OWNER_EMAIL || DEFAULT_PABLO_EMAIL).toLowerCase();
  const agents = await getAllAgents();
  const agent =
    agents.find((item) => item.email.toLowerCase() === agentEmail) ||
    agents.find((item) => item.name.toLowerCase().includes("pablo barrera")) ||
    agents.find((item) => item.role === "admin");

  if (!agent?.id) {
    throw new Error("No encontré el agente Pablo Barrera en el CRM para asignar los contactos.");
  }

  return agent.id;
}

async function getHubSpotOwners(token: string) {
  const owners: HubSpotOwner[] = [];
  let after = "";

  do {
    const query = new URLSearchParams({ archived: "false", limit: "100" });
    if (after) query.set("after", after);
    const data = await hubspotFetch<{ results?: HubSpotOwner[]; paging?: { next?: { after?: string } } }>(
      `/crm/v3/owners/?${query.toString()}`,
      token
    );
    owners.push(...(data.results || []));
    after = data.paging?.next?.after || "";
  } while (after);

  return owners
    .filter((owner) => owner.id)
    .sort((a, b) => ownerLabel(a).localeCompare(ownerLabel(b)));
}

function ownerLabel(owner: HubSpotOwner) {
  return [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim() || owner.email || owner.id;
}

async function getAgentIdForHubSpotOwner(
  ownerId: string | undefined,
  owners: HubSpotOwner[],
  fallbackAgentId: string,
  agentsOverride?: CrmAgentRecord[]
) {
  if (!ownerId) return fallbackAgentId;

  const owner = owners.find((item) => item.id === ownerId);
  if (!owner) return fallbackAgentId;

  const agents = agentsOverride || (await getAllAgents());
  const ownerEmail = owner.email?.toLowerCase();
  const ownerName = ownerLabel(owner).toLowerCase();
  const agent =
    (ownerEmail ? agents.find((item) => item.email.toLowerCase() === ownerEmail) : undefined) ||
    agents.find((item) => item.name.toLowerCase() === ownerName) ||
    agents.find((item) => ownerName && item.name.toLowerCase().includes(ownerName)) ||
    agents.find((item) => item.role === "admin");

  return agent?.id || fallbackAgentId;
}

async function getContactPropertyNames(token: string) {
  try {
    const data = await hubspotFetch<{ results?: HubSpotPropertyDefinition[] }>(
      "/crm/v3/properties/contacts",
      token
    );
    const hubspotNames = new Set(data.results?.map((property) => property.name).filter(Boolean) || []);
    return Array.from(hubspotNames);
  } catch (error) {
    console.warn("No se pudieron leer todas las propiedades de HubSpot, uso campos base:", error);
    return FALLBACK_PROPERTIES;
  }
}

function mapStatus(value?: string | null): CrmLeadStatus {
  if (value && isCrmLeadStatus(value)) return value;

  const normalized = (value || "").toLowerCase();
  if (normalized.includes("qualified") || normalized.includes("calificado")) return "IN_PROGRESS";
  if (normalized.includes("contact")) return "Contactado";
  if (normalized.includes("proposal") || normalized.includes("propuesta")) return "OPEN_DEAL";
  if (normalized.includes("deal") || normalized.includes("opportunity")) return "OPEN_DEAL";
  if (normalized.includes("lost") || normalized.includes("perdido") || normalized.includes("unqualified")) return "UNQUALIFIED";
  if (normalized.includes("customer") || normalized.includes("reserved")) return "Reservado";
  return "NEW";
}

function splitPhone(rawPhone?: string | null, fallbackCountry?: string | null) {
  return splitInternationalPhone(rawPhone, fallbackCountry);
}

function contactName(contact: HubSpotContact) {
  const props = contact.properties || {};
  const emailPrefix = props.email?.split("@")[0] || "Contacto";
  const firstName = props.firstname?.trim() || emailPrefix;
  const lastName = props.lastname?.trim() || "-";
  return { firstName, lastName };
}

function stripHtml(value?: string | null) {
  if (!value) return "";
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function hubSpotActivityTitle(
  definition: (typeof HUBSPOT_ACTIVITY_TYPES)[number],
  props: Record<string, string | null>
) {
  return (
    props.hs_call_title ||
    props.hs_meeting_title ||
    props.hs_email_subject ||
    props.hs_task_subject ||
    definition.title
  );
}

function hubSpotActivityBody(
  definition: (typeof HUBSPOT_ACTIVITY_TYPES)[number],
  props: Record<string, string | null>
) {
  const lines: string[] = [];
  const mainBody =
    props.hs_note_body ||
    props.hs_call_body ||
    props.hs_meeting_body ||
    props.hs_email_text ||
    props.hs_email_html ||
    props.hs_communication_body ||
    props.hs_task_body ||
    "";

  const text = stripHtml(mainBody);
  if (text) lines.push(text);

  if (definition.objectType === "calls") {
    if (props.hs_call_status) lines.push(`Estado de llamada: ${props.hs_call_status}`);
    if (props.hs_call_from_number || props.hs_call_to_number) {
      lines.push(
        `Desde/Hacia: ${[props.hs_call_from_number, props.hs_call_to_number].filter(Boolean).join(" -> ")}`
      );
    }
    if (props.hs_call_duration) lines.push(`Duración HubSpot: ${props.hs_call_duration} ms`);
  }

  if (definition.objectType === "meetings") {
    if (props.hs_meeting_start_time) lines.push(`Inicio: ${formatDateTime(props.hs_meeting_start_time)}`);
    if (props.hs_meeting_end_time) lines.push(`Fin: ${formatDateTime(props.hs_meeting_end_time)}`);
  }

  if (definition.objectType === "emails") {
    if (props.hs_email_from_email) lines.push(`De: ${props.hs_email_from_email}`);
    if (props.hs_email_to_email) lines.push(`Para: ${props.hs_email_to_email}`);
  }

  if (definition.objectType === "communications") {
    if (props.hs_communication_channel_type) lines.push(`Canal: ${props.hs_communication_channel_type}`);
    if (props.hs_communication_logged_from || props.hs_communication_logged_to) {
      lines.push(
        `Desde/Hacia: ${[props.hs_communication_logged_from, props.hs_communication_logged_to].filter(Boolean).join(" -> ")}`
      );
    }
  }

  if (definition.objectType === "tasks") {
    if (props.hs_task_status) lines.push(`Estado tarea: ${props.hs_task_status}`);
    if (props.hs_task_priority) lines.push(`Prioridad: ${props.hs_task_priority}`);
  }

  return lines.join("\n\n") || "Actividad importada desde HubSpot.";
}

async function getAssociatedObjectIds(token: string, contactId: string, objectType: string) {
  const data = await hubspotFetch<HubSpotAssociationResponse>(
    `/crm/v4/objects/contacts/${contactId}/associations/${objectType}?limit=${MAX_ACTIVITIES_PER_TYPE_PER_CONTACT}`,
    token
  );

  return (data.results || [])
    .map((result) => result.toObjectId)
    .filter((id): id is number => typeof id === "number")
    .map((id) => String(id));
}

async function getHubSpotObjects(
  token: string,
  objectType: string,
  ids: string[],
  properties: string[]
) {
  if (ids.length === 0) return [];

  const data = await hubspotFetch<HubSpotBatchReadResponse>(`/crm/v3/objects/${objectType}/batch/read`, token, {
    method: "POST",
    body: JSON.stringify({
      properties,
      inputs: ids.map((id) => ({ id })),
    }),
  });

  return data.results || [];
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantWords(value: string) {
  const ignoredWords = new Set(["the", "de", "del", "la", "el", "en", "place", "studios", "estudios"]);
  return normalizeSearch(value)
    .split(" ")
    .filter((word) => word.length > 2 && !ignoredWords.has(word));
}

function scoreDevelopmentMatch(development: { name: string; slug: string }, rawValue: string) {
  const value = normalizeSearch(rawValue);
  if (!value) return 0;

  const name = normalizeSearch(development.name);
  const slug = normalizeSearch(development.slug);
  if (name && value.includes(name)) return 1000;
  if (slug && value.includes(slug)) return 900;

  const words = significantWords(`${development.name} ${development.slug}`);
  if (words.length === 0) return 0;

  const uniqueWords = Array.from(new Set(words));
  let score = 0;
  for (const word of uniqueWords) {
    if (value.includes(word)) score += 10;
  }

  const lastWord = uniqueWords[uniqueWords.length - 1];
  if (lastWord && value.includes(lastWord)) score += 20;

  return score;
}

function hubSpotDevelopmentValues(props: Record<string, string | null>) {
  const prioritizedPropertyNames = [
    "desarrollo",
    "desarrollo_que_consulto",
    "desarrollo_que_consult",
    "development",
    "proyecto",
    "project",
    "first_conversion_event_name",
    "recent_conversion_event_name",
    "hs_latest_source_data_2",
    "hs_latest_source_data_1",
    "hs_analytics_first_url",
    "hs_analytics_last_url",
    "company",
  ];

  return [
    ...prioritizedPropertyNames
      .map((propertyName) => props[propertyName])
      .filter((value): value is string => Boolean(value?.trim())),
    ...Object.entries(props)
      .filter(([key, value]) => {
        if (!value?.trim()) return false;
        return /desarrollo|proyecto|project|campaign|campana|campaña|form|conversion|source|url/i.test(key);
      })
      .map(([, value]) => value)
      .filter((value): value is string => Boolean(value?.trim())),
    Object.values(props)
      .filter((value): value is string => Boolean(value?.trim()))
      .join(" "),
  ];
}

function directHubSpotDevelopmentName(props: Record<string, string | null>) {
  const directPropertyNames = [
    "desarrollo",
    "desarrollo_que_consulto",
    "desarrollo_que_consult",
    "development",
    "proyecto",
    "project",
  ];

  for (const propertyName of directPropertyNames) {
    const cleaned = cleanHubSpotDevelopmentName(props[propertyName]);
    if (cleaned) return cleaned;
  }

  const fallbackEntry = Object.entries(props).find(([key, value]) => {
    if (!value?.trim()) return false;
    return /desarrollo|proyecto|project/i.test(key);
  });

  return cleanHubSpotDevelopmentName(fallbackEntry?.[1]);
}

function matchDevelopmentIdFromValues(
  values: string[],
  developments: Array<{ id: string; name: string; slug: string }>,
  minimumScore: number
) {
  let bestMatch: { id: string; score: number } | undefined;
  for (const value of values) {
    for (const development of developments) {
      const score = scoreDevelopmentMatch(development, value);
      if (score > (bestMatch?.score || 0)) {
        bestMatch = { id: development.id, score };
      }
    }
  }

  return bestMatch && bestMatch.score >= minimumScore ? bestMatch.id : undefined;
}

function matchDevelopmentAliasFromHubSpotProperties(
  props: Record<string, string | null>,
  dataProperties: CrmDataProperty[]
) {
  const aliases = dataProperties.filter(
    (property) => property.type === "development" && property.active && property.localDevelopmentId
  );
  if (aliases.length === 0) return undefined;

  const values = hubSpotDevelopmentValues(props).map(normalizeSearch).filter(Boolean);
  for (const alias of aliases) {
    const candidates = [alias.value, alias.label, alias.hubspotValue || ""]
      .map(normalizeSearch)
      .filter(Boolean);
    const matched = values.some((value) =>
      candidates.some((candidate) => value.includes(candidate) || candidate.includes(value))
    );
    if (matched) return alias.localDevelopmentId;
  }

  return undefined;
}

function matchDevelopmentIdFromHubSpotProperties(
  props: Record<string, string | null>,
  developments: Array<{ id: string; name: string; slug: string }>,
  dataProperties: CrmDataProperty[] = []
) {
  const directName = directHubSpotDevelopmentName(props);
  const aliasMatch = matchDevelopmentAliasFromHubSpotProperties(props, dataProperties);
  if (aliasMatch && !directName) return aliasMatch;
  if (developments.length === 0) return undefined;

  if (directName) {
    return matchDevelopmentIdFromValues([directName], developments, 45);
  }

  const evidence = normalizeSearch([
    props.recent_conversion_event_name,
    props.first_conversion_event_name,
    props.hs_latest_source_data_2,
    props.hs_analytics_source_data_2,
  ].filter(Boolean).join(" "));
  const inferredName =
    evidence.includes("formulario libertador") ||
    (evidence.includes("campana alpha libertador") && !evidence.includes("belgrano"))
      ? "Alpha Place Libertador"
      : evidence.includes("feel recoleta")
        ? "Feel Recoleta"
        : evidence.includes("feel palermo")
          ? "Feel Palermo"
          : "";

  return inferredName ? matchDevelopmentIdFromValues([inferredName], developments, 45) : undefined;
}

function cleanHubSpotDevelopmentName(value?: string | null) {
  if (!value?.trim()) return "";

  const decoded = (() => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })();

  return decoded
    .replace(/^Facebook Lead Ads:\s*/i, "")
    .replace(/^formulario\s+/i, "")
    .replace(/^camp[aá]ña\s+/i, "")
    .replace(/[?&](utm|hsa)_[^=\s]+=[^\s&]+/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[_+]+/g, " ")
    .replace(/\s*&\s*/g, " & ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function findHubSpotDevelopmentName(
  props: Record<string, string | null>,
  developments: Array<{ id: string; name: string; slug: string }>,
  developmentId?: string,
  dataProperties: CrmDataProperty[] = []
) {
  const directName = directHubSpotDevelopmentName(props);
  if (directName) return directName;

  const matchedDevelopment = developmentId
    ? developments.find((development) => development.id === developmentId)
    : undefined;
  if (matchedDevelopment?.name) return matchedDevelopment.name;

  const alias = dataProperties.find((property) => {
    if (property.type !== "development" || !property.active) return false;
    const values = hubSpotDevelopmentValues(props).map(normalizeSearch).filter(Boolean);
    const candidates = [property.value, property.label, property.hubspotValue || ""]
      .map(normalizeSearch)
      .filter(Boolean);
    return values.some((value) =>
      candidates.some((candidate) => value.includes(candidate) || candidate.includes(value))
    );
  });
  if (alias?.label) return alias.label;

  const evidence = normalizeSearch([
    props.recent_conversion_event_name,
    props.first_conversion_event_name,
    props.hs_latest_source_data_2,
    props.hs_analytics_source_data_2,
  ].filter(Boolean).join(" "));
  if (evidence.includes("formulario libertador") ||
      (evidence.includes("campana alpha libertador") && !evidence.includes("belgrano"))) {
    return "Alpha Place Libertador";
  }
  if (evidence.includes("feel recoleta")) return "Feel Recoleta";
  if (evidence.includes("feel palermo")) return "Feel Palermo";
  if (evidence.includes("formulario high ticket")) return "High Ticket";
  if (evidence.includes("clientes potenciales peron")) return "Peron";
  return "";
}

function selectedDevelopmentMatches(
  selectedDevelopmentIds: string[],
  developmentId?: string,
  developmentNameText?: string
) {
  if (selectedDevelopmentIds.length === 0) return true;
  if (developmentId && selectedDevelopmentIds.includes(developmentId)) return true;
  const normalizedName = normalizeSearch(developmentNameText || "");
  if (!normalizedName) return false;
  return selectedDevelopmentIds.some((value) => {
    if (!value.startsWith("name:")) return false;
    return normalizeSearch(value.slice(5)) === normalizedName;
  });
}

async function fetchFilteredContacts(
  token: string,
  properties: string[],
  filters: {
    ownerIds: string[];
    leadStatuses: string[];
  },
  after = ""
) {
  const hubspotFilters: Array<{ propertyName: string; operator: string; value?: string; values?: string[] }> = [
      {
        propertyName: "createdate",
        operator: "LTE",
        value: new Date().toISOString(),
      },
    ];

    if (filters.ownerIds.length === 1) {
      hubspotFilters.push({
        propertyName: "hubspot_owner_id",
        operator: "EQ",
        value: filters.ownerIds[0],
      });
    } else if (filters.ownerIds.length > 1) {
      hubspotFilters.push({
        propertyName: "hubspot_owner_id",
        operator: "IN",
        values: filters.ownerIds,
      });
    }

    if (filters.leadStatuses.length === 1) {
      hubspotFilters.push({
        propertyName: "hs_lead_status",
        operator: "EQ",
        value: filters.leadStatuses[0],
      });
    } else if (filters.leadStatuses.length > 1) {
      hubspotFilters.push({
        propertyName: "hs_lead_status",
        operator: "IN",
        values: filters.leadStatuses,
      });
    }

  const data = await hubspotFetch<HubSpotSearchResponse>("/crm/v3/objects/contacts/search", token, {
      method: "POST",
      body: JSON.stringify({
        filterGroups: [{ filters: hubspotFilters }],
        sorts: [
          {
            propertyName: "createdate",
            direction: "DESCENDING",
          },
        ],
        properties,
        limit: HUBSPOT_IMPORT_BATCH_SIZE,
        ...(after ? { after } : {}),
      }),
    });

  return {
    contacts: data.results || [],
    nextAfter: data.paging?.next?.after || "",
  };
}

async function importHubSpotActivitiesForContact({
  token,
  contactId,
  leadId,
  owners,
  crmAgents,
  fallbackAgentId,
  disabledActivityTypes,
}: {
  token: string;
  contactId: string;
  leadId: string;
  owners: HubSpotOwner[];
  crmAgents: CrmAgentRecord[];
  fallbackAgentId: string;
  disabledActivityTypes: Set<string>;
}) {
  let imported = 0;
  let failed = 0;

  for (const definition of HUBSPOT_ACTIVITY_TYPES) {
    if (disabledActivityTypes.has(definition.objectType)) continue;

    try {
      const ids = await getAssociatedObjectIds(token, contactId, definition.objectType);
      const objects = await getHubSpotObjects(token, definition.objectType, ids, definition.properties);

      for (const object of objects) {
        try {
          const props = object.properties || {};
          const scheduledAt = props.hs_timestamp || props.hs_meeting_start_time || object.createdAt;
          const createdBy = await getAgentIdForHubSpotOwner(
            props.hubspot_owner_id || undefined,
            owners,
            fallbackAgentId,
            crmAgents
          );
          const result = await createCrmActivity({
            leadId,
            type: definition.crmType,
            title: hubSpotActivityTitle(definition, props),
            body: hubSpotActivityBody(definition, props),
            scheduledAt: scheduledAt || undefined,
            createdBy,
            externalSource: "HubSpot",
            externalId: `${definition.objectType}:${object.id}`,
          });

          if (result.activity) imported += 1;
          else failed += 1;
        } catch (error) {
          failed += 1;
          console.error(`Error saving HubSpot ${definition.objectType} ${object.id}:`, error);
        }
      }
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "";
      if (/HubSpot (401|403|404)/.test(message)) {
        disabledActivityTypes.add(definition.objectType);
        console.warn(`No se pudo leer ${definition.objectType} de HubSpot. Se omite ese tipo.`, error);
      } else {
        console.error(`Error importing HubSpot ${definition.objectType} for contact ${contactId}:`, error);
      }
    }
  }

  return { imported, failed };
}

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageAdminPanel(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Falta HUBSPOT_ACCESS_TOKEN en las variables de entorno." },
      { status: 500 }
    );
  }

  try {
    const [owners, developments, dataProperties] = await Promise.all([
      getHubSpotOwners(token),
      getDevelopments(),
      getCrmDataProperties(),
    ]);
    const customDevelopments = dataProperties
      .filter((property) => property.type === "development" && property.active)
      .map((property) => ({
        id: property.localDevelopmentId || `name:${property.label}`,
        name: property.label,
      }));
    const customLeadStatuses = dataProperties
      .filter((property) => property.type === "lead_status" && property.active)
      .map((property) => ({
        value: property.hubspotValue || property.value,
        label: property.label,
      }));

    return NextResponse.json({
      owners: owners.map((owner) => ({
        id: owner.id,
        name: ownerLabel(owner),
        email: owner.email || "",
      })),
      developments: [
        ...developments.map((development) => ({
          id: development.id,
          name: development.name,
        })),
        ...customDevelopments,
      ],
      leadStatuses: [...HUBSPOT_LEAD_STATUS_OPTIONS, ...customLeadStatuses],
    });
  } catch (error) {
    console.error("Error loading HubSpot import options:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar los filtros de HubSpot" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageAdminPanel(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Falta HUBSPOT_ACCESS_TOKEN en las variables de entorno." },
      { status: 500 }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const selectedOwnerIds = parseStringArray(body.ownerIds);
    const selectedDevelopmentIds = parseStringArray(body.developmentIds);
    const selectedLeadStatuses = parseStringArray(body.leadStatuses);
    const after = typeof body.after === "string" ? body.after : "";

    const [fallbackOwnerId, fallbackAgentId, owners, crmAgents, properties, developments, dataProperties] = await Promise.all([
      getPabloHubSpotOwnerId(token),
      getPabloAgentId(),
      getHubSpotOwners(token),
      getAllAgents(),
      getContactPropertyNames(token),
      getDevelopments(),
      getCrmDataProperties(),
    ]);
    const ownerIds = selectedOwnerIds.length > 0 ? selectedOwnerIds : [];
    const { contacts, nextAfter } = await fetchFilteredContacts(token, properties, {
      ownerIds,
      leadStatuses: selectedLeadStatuses,
    }, after);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let skippedWithoutEmail = 0;
    let skippedByDevelopment = 0;
    let failed = 0;
    let importedActivities = 0;
    let failedActivities = 0;
    let activityContactsProcessed = 0;
    let activityContactsSkipped = 0;
    const disabledActivityTypes = new Set<string>();

    for (const contact of contacts) {
      try {
        const props = contact.properties || {};
        const developmentId = matchDevelopmentIdFromHubSpotProperties(props, developments, dataProperties);
        const developmentNameText = findHubSpotDevelopmentName(props, developments, developmentId, dataProperties);
        if (!selectedDevelopmentMatches(selectedDevelopmentIds, developmentId, developmentNameText)) {
          skippedByDevelopment += 1;
          continue;
        }
        const hubSpotOwner = owners.find((owner) => owner.id === props.hubspot_owner_id);
        const assignedAgent = hubSpotOwner
          ? crmAgents.find((agent) => agent.email.toLowerCase() === (hubSpotOwner.email || "").toLowerCase())
          : undefined;
        const result = await upsertCrmLeadFromHubSpot({
          objectId: contact.id,
          properties: props,
          developmentId,
          developmentNameText,
          assignedAgentId: assignedAgent?.id,
          createdBy: session.user.id,
        });

        if (result.lead) {
          if (result.created) created += 1;
          else updated += 1;

          if (activityContactsProcessed < MAX_ACTIVITY_CONTACTS_PER_IMPORT) {
            const activityResult = await importHubSpotActivitiesForContact({
              token,
              contactId: contact.id,
              leadId: result.lead.id,
              owners,
              crmAgents,
              fallbackAgentId,
              disabledActivityTypes,
            });
            activityContactsProcessed += 1;
            importedActivities += activityResult.imported;
            failedActivities += activityResult.failed;
          } else {
            activityContactsSkipped += 1;
          }
        } else {
          skipped += 1;
        }
      } catch (error) {
        failed += 1;
        console.error(`Error importing HubSpot contact ${contact.id}:`, error);
        skipped += 1;
      }
    }

    const leads = await getCrmLeads({
      agentId: session.user.id,
      includeAll: canViewAllCrmContacts(session.user.role),
    });

    return NextResponse.json({
      imported: contacts.length,
      created,
      updated,
      skipped,
      skippedWithoutEmail,
      skippedByDevelopment,
      failed,
      importedActivities,
      failedActivities,
      activityContactsProcessed,
      activityContactsSkipped,
      maxActivityContactsPerImport: MAX_ACTIVITY_CONTACTS_PER_IMPORT,
      unavailableActivityTypes: Array.from(disabledActivityTypes),
      nextAfter,
      hasMore: Boolean(nextAfter),
      batchSize: HUBSPOT_IMPORT_BATCH_SIZE,
      leads,
    });
  } catch (error) {
    console.error("Error importing HubSpot contacts:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo importar desde HubSpot" },
      { status: 500 }
    );
  }
}
