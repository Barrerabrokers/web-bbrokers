import postgres from "postgres";

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v26.0";
const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

type MetaAction = { action_type?: string; value?: string };

type MetaCampaignResponse = {
  id: string;
  name: string;
  status?: string;
  effective_status?: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  updated_time?: string;
  insights?: {
    data?: Array<{
      spend?: string;
      impressions?: string;
      reach?: string;
      clicks?: string;
      ctr?: string;
      cpc?: string;
      frequency?: string;
      actions?: MetaAction[];
      cost_per_action_type?: MetaAction[];
    }>;
  };
};

export type MetaCampaignPerformance = {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  objective: string;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  frequency: number;
  leads: number;
  costPerLead: number | null;
  crmLeads: number;
  qualifiedLeads: number;
  meetings: number;
  costPerQualifiedLead: number | null;
};

export type MetaMarketingDashboard = {
  account: { id: string; name: string; currency: string; timezone: string };
  period: { days: number; since: string; until: string };
  campaigns: MetaCampaignPerformance[];
  totals: Omit<MetaCampaignPerformance, "id" | "name" | "status" | "effectiveStatus" | "objective" | "dailyBudget" | "lifetimeBudget">;
  warnings: string[];
  updatedAt: string;
};

function databaseUrl() {
  return process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
}

function numberValue(value?: string | number | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function actionValue(actions: MetaAction[] | undefined, names: string[]) {
  const entry = actions?.find((action) => names.includes(action.action_type || ""));
  return numberValue(entry?.value);
}

async function metaJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("Falta configurar META_ACCESS_TOKEN.");

  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${META_GRAPH_BASE_URL}/${path}${separator}access_token=${encodeURIComponent(token)}`, {
    ...init,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as { error?: { message?: string; code?: number } } | null;
  if (!response.ok || payload?.error) {
    const message = payload?.error?.message || `Meta respondió ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

async function getAdAccount() {
  const configured = process.env.META_AD_ACCOUNT_ID?.trim();
  if (configured) {
    const id = configured.startsWith("act_") ? configured : `act_${configured}`;
    return metaJson<{ id: string; name?: string; currency?: string; timezone_name?: string }>(
      `${id}?fields=id,name,currency,timezone_name`
    );
  }

  const accounts = await metaJson<{ data?: Array<{ id: string; name?: string; currency?: string; timezone_name?: string }> }>(
    "me/adaccounts?fields=id,name,currency,timezone_name,account_status&limit=25"
  );
  const account = accounts.data?.[0];
  if (!account) throw new Error("El token de Meta no tiene acceso a ninguna cuenta publicitaria.");
  return account;
}

async function getCrmCampaignMetrics(since: string) {
  const url = databaseUrl();
  if (!url) return { byCampaign: new Map<string, { leads: number; qualified: number; meetings: number }>(), total: { leads: 0, qualified: 0, meetings: 0 } };

  const sql = postgres(url, { ssl: "require", max: 1, prepare: false });
  try {
    const rows = await sql`
      SELECT
        COALESCE(NULLIF(meta_properties->>'meta_campaign_id', ''), '') AS campaign_id,
        COUNT(*)::int AS leads,
        COUNT(*) FILTER (WHERE lower(status) IN ('interesado','en curso','reunion','reservado','vendido','calificado','qualified','open deal','connected'))::int AS qualified,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM crm_activities a WHERE a.lead_id = crm_leads.id AND a.type = 'reunion'
        ))::int AS meetings
      FROM crm_leads
      WHERE meta_lead_id IS NOT NULL
        AND COALESCE(NULLIF(meta_properties->>'meta_created_time', '')::timestamptz, created_at) >= ${since}::timestamptz
      GROUP BY 1
    `;
    const byCampaign = new Map<string, { leads: number; qualified: number; meetings: number }>();
    const total = { leads: 0, qualified: 0, meetings: 0 };
    for (const row of rows) {
      const metrics = { leads: Number(row.leads), qualified: Number(row.qualified), meetings: Number(row.meetings) };
      byCampaign.set(String(row.campaign_id || ""), metrics);
      total.leads += metrics.leads;
      total.qualified += metrics.qualified;
      total.meetings += metrics.meetings;
    }
    return { byCampaign, total };
  } finally {
    await sql.end();
  }
}

export async function getMetaMarketingDashboard(days: number): Promise<MetaMarketingDashboard> {
  const safeDays = [7, 30, 90].includes(days) ? days : 30;
  const untilDate = new Date();
  const sinceDate = new Date(untilDate);
  sinceDate.setUTCDate(sinceDate.getUTCDate() - safeDays + 1);
  const since = sinceDate.toISOString().slice(0, 10);
  const until = untilDate.toISOString().slice(0, 10);
  const account = await getAdAccount();
  const timeRange = encodeURIComponent(JSON.stringify({ since, until }));
  const fields = [
    "id", "name", "status", "effective_status", "objective", "daily_budget", "lifetime_budget", "updated_time",
    `insights.time_range(${JSON.stringify({ since, until })}){spend,impressions,reach,clicks,ctr,cpc,frequency,actions,cost_per_action_type}`,
  ].join(",");
  const response = await metaJson<{ data?: MetaCampaignResponse[] }>(
    `${account.id}/campaigns?fields=${encodeURIComponent(fields)}&limit=200`
  );
  const crm = await getCrmCampaignMetrics(`${since}T00:00:00.000Z`);

  const campaigns = (response.data || []).map((campaign): MetaCampaignPerformance => {
    const insight = campaign.insights?.data?.[0];
    const leads = actionValue(insight?.actions, ["lead", "onsite_conversion.lead_grouped", "onsite_conversion.lead"]);
    const cplFromMeta = actionValue(insight?.cost_per_action_type, ["lead", "onsite_conversion.lead_grouped", "onsite_conversion.lead"]);
    const crmMetric = crm.byCampaign.get(campaign.id) || { leads: 0, qualified: 0, meetings: 0 };
    const spend = numberValue(insight?.spend);
    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status || "UNKNOWN",
      effectiveStatus: campaign.effective_status || campaign.status || "UNKNOWN",
      objective: campaign.objective || "",
      dailyBudget: campaign.daily_budget ? numberValue(campaign.daily_budget) / 100 : null,
      lifetimeBudget: campaign.lifetime_budget ? numberValue(campaign.lifetime_budget) / 100 : null,
      spend,
      impressions: numberValue(insight?.impressions),
      reach: numberValue(insight?.reach),
      clicks: numberValue(insight?.clicks),
      ctr: numberValue(insight?.ctr),
      cpc: numberValue(insight?.cpc),
      frequency: numberValue(insight?.frequency),
      leads,
      costPerLead: leads > 0 ? (cplFromMeta || spend / leads) : null,
      crmLeads: crmMetric.leads,
      qualifiedLeads: crmMetric.qualified,
      meetings: crmMetric.meetings,
      costPerQualifiedLead: crmMetric.qualified > 0 ? spend / crmMetric.qualified : null,
    };
  }).sort((a, b) => b.spend - a.spend);

  const totals = campaigns.reduce((sum, campaign) => ({
    spend: sum.spend + campaign.spend,
    impressions: sum.impressions + campaign.impressions,
    reach: sum.reach + campaign.reach,
    clicks: sum.clicks + campaign.clicks,
    ctr: 0,
    cpc: 0,
    frequency: 0,
    leads: sum.leads + campaign.leads,
    costPerLead: null,
    crmLeads: sum.crmLeads + campaign.crmLeads,
    qualifiedLeads: sum.qualifiedLeads + campaign.qualifiedLeads,
    meetings: sum.meetings + campaign.meetings,
    costPerQualifiedLead: null,
  }), { spend: 0, impressions: 0, reach: 0, clicks: 0, ctr: 0, cpc: 0, frequency: 0, leads: 0, costPerLead: null as number | null, crmLeads: 0, qualifiedLeads: 0, meetings: 0, costPerQualifiedLead: null as number | null });
  totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  totals.cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  totals.frequency = totals.reach > 0 ? totals.impressions / totals.reach : 0;
  totals.costPerLead = totals.leads > 0 ? totals.spend / totals.leads : null;
  totals.costPerQualifiedLead = crm.total.qualified > 0 ? totals.spend / crm.total.qualified : null;
  totals.crmLeads = crm.total.leads;
  totals.qualifiedLeads = crm.total.qualified;
  totals.meetings = crm.total.meetings;

  const warnings: string[] = [];
  if (totals.leads > 0 && totals.crmLeads < totals.leads) warnings.push(`Meta informa ${totals.leads} leads y el CRM puede atribuir ${totals.crmLeads}. Revisá la atribución antes de escalar presupuesto.`);
  if (totals.crmLeads > 0 && totals.qualifiedLeads === 0) warnings.push("Todavía no hay leads calificados atribuidos a campañas en este período.");

  return {
    account: { id: account.id, name: account.name || account.id, currency: account.currency || "USD", timezone: account.timezone_name || "" },
    period: { days: safeDays, since, until },
    campaigns,
    totals,
    warnings,
    updatedAt: new Date().toISOString(),
  };
}

export async function updateMetaCampaignStatus(campaignId: string, status: "ACTIVE" | "PAUSED") {
  return metaJson<{ success?: boolean }>(campaignId, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ status }),
  });
}
