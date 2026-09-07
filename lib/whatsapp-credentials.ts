import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import postgres from "postgres";

export type WhatsAppChannelCredentials = {
  accessToken: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  connectedAt: string;
  updatedAt: string;
};

function databaseUrl() {
  return process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
}

function encryptionKey() {
  const secret = process.env.CRM_EMAIL_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("Falta configurar un secreto para proteger la conexión de WhatsApp.");
  return createHash("sha256").update(secret).digest();
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
}

function decrypt(value: string) {
  const [iv, tag, encrypted] = value.split(":");
  if (!iv || !tag || !encrypted) throw new Error("La credencial de WhatsApp guardada no es válida.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}

async function ensureTable(sql: ReturnType<typeof postgres>) {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS crm_whatsapp_credentials (
      id TEXT PRIMARY KEY,
      encrypted_access_token TEXT NOT NULL,
      waba_id TEXT NOT NULL,
      phone_number_id TEXT NOT NULL,
      display_phone_number TEXT NOT NULL DEFAULT '',
      connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function saveWhatsAppChannelCredentials(input: {
  accessToken: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber?: string;
}) {
  const url = databaseUrl();
  if (!url) throw new Error("No database connection URL found");
  const sql = postgres(url, { ssl: "require", max: 1, prepare: false });
  try {
    await ensureTable(sql);
    await sql`
      INSERT INTO crm_whatsapp_credentials (id, encrypted_access_token, waba_id, phone_number_id, display_phone_number)
      VALUES ('primary', ${encrypt(input.accessToken)}, ${input.wabaId}, ${input.phoneNumberId}, ${input.displayPhoneNumber || ""})
      ON CONFLICT (id) DO UPDATE SET
        encrypted_access_token = EXCLUDED.encrypted_access_token,
        waba_id = EXCLUDED.waba_id,
        phone_number_id = EXCLUDED.phone_number_id,
        display_phone_number = EXCLUDED.display_phone_number,
        connected_at = NOW(),
        updated_at = NOW()
    `;
  } finally {
    await sql.end();
  }
}

export async function getWhatsAppChannelCredentials(): Promise<WhatsAppChannelCredentials | null> {
  const url = databaseUrl();
  if (!url) return null;
  const sql = postgres(url, { ssl: "require", max: 1, prepare: false });
  try {
    await ensureTable(sql);
    const rows = await sql`
      SELECT encrypted_access_token, waba_id, phone_number_id, display_phone_number, connected_at, updated_at
      FROM crm_whatsapp_credentials WHERE id = 'primary' LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      accessToken: decrypt(String(row.encrypted_access_token)),
      wabaId: String(row.waba_id),
      phoneNumberId: String(row.phone_number_id),
      displayPhoneNumber: String(row.display_phone_number || ""),
      connectedAt: new Date(row.connected_at as string).toISOString(),
      updatedAt: new Date(row.updated_at as string).toISOString(),
    };
  } finally {
    await sql.end();
  }
}
