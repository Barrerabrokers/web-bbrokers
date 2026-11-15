import { extractWhatsAppForm } from "./whatsapp-form-context";
import { splitInternationalPhone } from "./phone-countries";

const fieldNames: Record<string, string> = {
  name: "full_name", email: "email", phone: "phone_number", apartment: "tipo_de_departamento",
  budget: "presupuesto", purchase: "forma_de_compra", timeline: "plazo_de_compra", confirmation: "confirmacion_de_interes",
};
const missing = (value: unknown) => !String(value || "").trim() || String(value).trim() === "-";
export function whatsAppLeadPatch(lead: Record<string, any>, content: string, messageId: string, createdAt: string, senderPhone = "") {
  const form = extractWhatsAppForm(content);
  const props: Record<string, any> = { ...(lead.meta_properties || {}) };
  const fields = Object.fromEntries(Object.entries(form).map(([key, value]) => [fieldNames[key], value]));
  if (!Object.keys(fields).length) return null;
  let submissions: any[] = [];
  try { const parsed = JSON.parse(props.whatsapp_form_submissions || "[]"); if (Array.isArray(parsed)) submissions = parsed; } catch {}
  const submission = { leadId: messageId, formId: "whatsapp", formName: "Formulario recibido por WhatsApp", createdTime: createdAt, fields };
  if (!submissions.some(item => item.leadId === messageId)) submissions.push(submission);
  props.whatsapp_form_submissions = JSON.stringify(submissions);
  const patch: Record<string, any> = { meta_properties: props };
  if (form.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && (missing(lead.email) || /@(whatsapp|facebook|instagram)\.(local|invalid)$/i.test(lead.email))) patch.email = form.email.toLowerCase();
  const parts = form.name?.trim().split(/\s+/) || [];
  if (parts.length && (missing(lead.first_name) || /^(contacto|whatsapp|sin nombre)$/i.test(lead.first_name) || /^[+\d\s()-]+$/.test(lead.first_name))) {
    patch.first_name = parts[0];
    if (missing(lead.last_name) || /^whatsapp$/i.test(lead.last_name)) patch.last_name = parts.slice(1).join(" ");
  } else if (parts.length > 1 && missing(lead.last_name) && parts[0].toLowerCase() === String(lead.first_name).toLowerCase()) patch.last_name = parts.slice(1).join(" ");
  if (missing(lead.phone)) {
    const rawPhone = form.phone || senderPhone;
    if (/^[+\d\s().-]+$/.test(rawPhone) && rawPhone.replace(/\D/g, "").length >= 7) {
      const phone = splitInternationalPhone(rawPhone.startsWith("+") ? rawPhone : senderPhone === rawPhone ? `+${rawPhone}` : rawPhone, lead.country_code);
      patch.phone = phone.phone; patch.country_code = phone.countryCode;
    }
  }
  return patch;
}

// Runs inside the message transaction: either the message and form persist together,
// or the webhook can retry. Existing commercial/contact values are preserved.
export async function persistWhatsAppLeadForm(tx: any, conversationId: string, content: string, messageId: string, createdAt: string) {
  const referral = whatsAppAdReferral(content);
  if (!Object.keys(extractWhatsAppForm(content)).length && !referral) return;
  const [context] = await tx`SELECT lead_id,phone FROM crm_whatsapp_conversations WHERE id=${conversationId}`;
  if (!context?.lead_id) return;
  await persistLeadWhatsAppForm(tx, context.lead_id, content, messageId, createdAt, context.phone);
  if (referral) {
    const campaigns = await tx`SELECT DISTINCT meta_properties->>'meta_campaign_name' AS name FROM crm_leads WHERE meta_properties->>'meta_ad_id'=${referral.source_id} AND NULLIF(meta_properties->>'meta_campaign_name','') IS NOT NULL LIMIT 2`;
    const properties: Record<string, string> = { whatsapp_referral_ad_id: referral.source_id };
    if (campaigns.length === 1) properties.whatsapp_referral_campaign_name = campaigns[0].name;
    await tx`UPDATE crm_leads SET meta_properties=COALESCE(meta_properties,'{}'::jsonb) || ${tx.json(properties)},updated_at=NOW() WHERE id=${context.lead_id}`;
  }
}

export async function persistLeadWhatsAppForm(tx: any, leadId: string, content: string, messageId: string, createdAt: string, senderPhone = "") {
  if (!Object.keys(extractWhatsAppForm(content)).length) return;
  const [lead] = await tx`SELECT * FROM crm_leads WHERE id=${leadId} FOR UPDATE`;
  if (!lead) return;
  const patch = whatsAppLeadPatch(lead, content, messageId, createdAt, senderPhone);
  if (!patch) return;
  if (patch.email) {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${'crm-form-email:'+patch.email},0))`;
    const [conflict] = await tx`SELECT id FROM crm_leads WHERE lower(btrim(email))=${patch.email} AND id<>${lead.id} LIMIT 1`;
    if (conflict) {
      // Retain the submitted email visibly; don't merge different contacts automatically.
      patch.meta_properties.whatsapp_form_email_conflict = String(conflict.id);
      delete patch.email;
    }
  }
  const changes = Object.keys(patch);
  await tx`UPDATE crm_leads SET ${tx(patch, ...changes)}, updated_at=NOW() WHERE id=${lead.id}`;
}


// Headlines and creative copy identify an ad, not necessarily the campaign name.
// Only a verified ad id shared with Meta lead metadata can supply the campaign.
export function whatsAppAdReferral(content: string): { source_id: string } | null {
  const marker = "\n[Origen del anuncio]\n";
  const index = content.indexOf(marker);
  if (index < 0) return null;
  try {
    const record = JSON.parse(content.slice(index + marker.length));
    return record.source_type === "ad" && /^\d+$/.test(String(record.source_id || "")) ? { source_id: String(record.source_id) } : null;
  } catch { return null; }
}
