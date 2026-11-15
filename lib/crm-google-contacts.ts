import { acquireWorkerLease, releaseWorkerLease } from "@/lib/database-worker-lease";
import postgres from "postgres";
import { createHash } from "crypto";
import { getCrmEmailAccountWithSecret } from "@/lib/db";
import { getAccessTokenForGoogleAccount } from "@/lib/google-oauth";
import { splitInternationalPhone } from "@/lib/phone-countries";

export const CONTACT_ACCOUNTS = ["pablo@barrerabrokers.com", "martina@barrerabrokers.com"];
export const CONTACT_SCOPE = "https://www.googleapis.com/auth/contacts";
const MARKER = "Barrera Brokers CRM lead";
const FIELDS = "names,emailAddresses,phoneNumbers,userDefined,metadata";
type Person = { resourceName?: string; metadata?: unknown; userDefined?: { key: string; value: string }[] };
type Lead = { id: string; first_name: string; last_name: string; email: string; phone: string | null; country_code: string | null };

export function contactPayload(lead: Lead) {
  const phone = splitInternationalPhone(lead.phone, lead.country_code);
  return {
    names: [{ givenName: lead.first_name || "", familyName: lead.last_name || "" }],
    emailAddresses: lead.email ? [{ value: lead.email.trim(), type: "other" }] : [],
    phoneNumbers: phone.phone ? [{ value: `${phone.countryCode}${phone.phone}`, type: "mobile" }] : [],
    userDefined: [{ key: MARKER, value: lead.id }],
  };
}

export function managedContact(people: Person[], leadId: string) {
  return people.find(person => person.userDefined?.some(field => field.key === MARKER && field.value === leadId));
}

// Canonical-table scanning covers every ingestion path and existing assigned leads.
export async function processCrmGoogleContacts() {
  const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("Falta la conexión a la base de datos.");
  const sql = postgres(url, { ssl: "require", max: 1, prepare: false });
  const origin = process.env.NEXTAUTH_URL || "https://barrerabrokers.com";
  const result = { synced: 0, failed: 0, pending: false, accounts: [] as { email: string; error?: string }[] };
  const deadline = Date.now() + 45000;
  try {
    const lease = await acquireWorkerLease(sql,"google-contacts");
    if (!lease) return { ...result, pending: true };
    try {
      for (const email of CONTACT_ACCOUNTS) {
        try {
          const agents = await sql`SELECT id FROM agents WHERE lower(trim(email))=${email}`;
          if (agents.length !== 1) throw new Error("No se encontró un único agente para esta cuenta.");
          const agentId = String(agents[0].id);
          const account = await getCrmEmailAccountWithSecret(agentId);
          // Validate both the owner and the Google identity before exporting data.
          if (!account || account.provider !== "google-oauth" || account.email.trim().toLowerCase() !== email) throw new Error(`Conectá ${email} en Correo del CRM.`);
          if (!account.googleScopes?.split(" ").includes(CONTACT_SCOPE)) throw new Error(`Reconectá ${email} y autorizá Google Contactos.`);
          const leads = await sql`SELECT l.id,s.resource_name,s.synced_version,s.create_pending
            FROM crm_leads l LEFT JOIN crm_google_contact_sync s ON s.lead_id=l.id AND s.account_email=${email}
            WHERE l.assigned_agent_id=${agentId} AND (NULLIF(trim(l.email),'') IS NOT NULL OR NULLIF(trim(l.phone),'') IS NOT NULL)
            AND (s.synced_version IS NULL OR s.last_error IS NOT NULL OR s.checked_at IS NULL OR l.updated_at>s.checked_at)
            ORDER BY s.checked_at ASC NULLS FIRST,l.created_at ASC LIMIT 50`;
          if (!leads.length) { result.accounts.push({ email }); continue; }
          const token = await getAccessTokenForGoogleAccount({ origin, account });
          const request = async (path: string, method = "GET", body?: unknown) => {
            const response = await fetch(`https://people.googleapis.com/v1/${path}`, {
              method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000),
            });
            const data = await response.json().catch(() => null);
            if (!response.ok) throw Object.assign(new Error(`Google Contactos: error ${response.status}.`), { status: response.status });
            return data;
          };
          // Reconcile uncertain creates by the CRM marker, never by name alone.
          const people: Person[] = [];
          let pageToken = "";
          do {
            if (Date.now() > deadline) throw new Error("Sincronización pendiente para la próxima ejecución.");
            const params = new URLSearchParams({ personFields: FIELDS, pageSize: "1000", sources: "READ_SOURCE_TYPE_CONTACT" });
            if (pageToken) params.set("pageToken", pageToken);
            const page = await request(`people/me/connections?${params}`);
            people.push(...(page.connections || []));
            pageToken = page.nextPageToken || "";
          } while (pageToken);
          for (const lead of leads) {
            if (Date.now() > deadline) { result.pending = true; break; }
            const leadId = String(lead.id);
            await sql`INSERT INTO crm_google_contact_sync(lead_id,account_email) VALUES (${leadId},${email}) ON CONFLICT DO NOTHING`;
            try {
              const [current] = await sql`SELECT id,first_name,last_name,email,phone,country_code,updated_at FROM crm_leads WHERE id=${leadId} AND assigned_agent_id=${agentId}`;
              if (!current) continue;
              const payload = contactPayload(current as unknown as Lead);
              const version = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
              if (lead.synced_version === version) {
                await sql`UPDATE crm_google_contact_sync SET checked_at=${current.updated_at},last_error=NULL WHERE lead_id=${leadId} AND account_email=${email}`;
                continue;
              }
              let person = managedContact(people, leadId);
              if (lead.resource_name) {
                try { person = await request(`${lead.resource_name}?personFields=${FIELDS}`); }
                catch (error) { if ((error as {status?:number}).status !== 404) throw error; }
              }
              let saved: Person;
              if (person?.resourceName) {
                const userDefined = [...(person.userDefined || []).filter(field => field.key !== MARKER), ...payload.userDefined];
                saved = await request(`${person.resourceName}:updateContact?updatePersonFields=names,emailAddresses,phoneNumbers,userDefined&personFields=${FIELDS}`, "PATCH", { ...payload, userDefined, resourceName: person.resourceName, metadata: person.metadata });
              } else {
                if (lead.create_pending) throw new Error("Creación pendiente de confirmación en Google; no se repetirá para evitar duplicados.");
                await sql`UPDATE crm_google_contact_sync SET create_pending=TRUE WHERE lead_id=${leadId} AND account_email=${email}`;
                try { saved = await request(`people:createContact?personFields=${FIELDS}`, "POST", payload); }
                catch (error) {
                  const status = (error as {status?:number}).status;
                  if (status && status >= 400 && status < 500) await sql`UPDATE crm_google_contact_sync SET create_pending=FALSE WHERE lead_id=${leadId} AND account_email=${email}`;
                  throw error;
                }
              }
              if (!saved?.resourceName) throw new Error("Google no confirmó la identidad del contacto.");
              people.push({ ...saved, userDefined: payload.userDefined });
              await sql`UPDATE crm_google_contact_sync SET resource_name=${saved.resourceName},synced_version=${version},create_pending=FALSE,checked_at=${current.updated_at},last_error=NULL WHERE lead_id=${leadId} AND account_email=${email}`;
              result.synced++;
            } catch (error) {
              result.failed++; result.pending = true;
              await sql`UPDATE crm_google_contact_sync SET checked_at=NOW(),last_error=${error instanceof Error ? error.message : "Error de sincronización."} WHERE lead_id=${leadId} AND account_email=${email}`;
            }
          }
          result.accounts.push({ email });
        } catch (error) {
          result.failed++; result.pending = true;
          result.accounts.push({ email, error: error instanceof Error ? error.message : "Error de sincronización." });
        }
      }
      return result;
    } finally { await releaseWorkerLease(sql,"google-contacts",lease); }
  } finally { await sql.end(); }
}
