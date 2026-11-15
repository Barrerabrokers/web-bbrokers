// The editable CRM field is independent from both development and source channel.
// Meta's original campaign metadata remains intact for attribution/auditing.
export function getCrmCampaign(properties?: Record<string, unknown>): string {
  if (typeof properties?.crm_campaign_name === "string") return properties.crm_campaign_name.trim();
  if (typeof properties?.whatsapp_referral_campaign_name === "string") return properties.whatsapp_referral_campaign_name.trim();
  return typeof properties?.meta_campaign_name === "string" ? properties.meta_campaign_name.trim() : "";
}
export function crmCampaignPatch(campaignName?: string): Record<string, string> {
  return typeof campaignName === "string" ? { crm_campaign_name: campaignName.trim() } : {};
}

// Legacy CRM imports also contain real developments no longer in the active catalog.
// Keep those selectable, while campaigns, areas and generic interests are excluded.
export function isCrmDevelopmentName(value: string): boolean {
  const name = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return Boolean(name) && !/^(campana\b|consulta de zona\s*:)/.test(name)
    && !["todos", "usado", "high ticket", "palermo/recoleta", "recoleta/palermo", "belgrano/nunez", "tres ambientes", "san telmo", "caballito", "montserrat", "monserrat"].includes(name);
}
