import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import postgres from "postgres";
type Connection = { token: string; pageId: string; appId: string };
function key() {
  const secret = process.env.CRM_EMAIL_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Falta la clave de protección del CRM.");
  return createHash("sha256").update(secret).digest();
}
export async function socialConnectionStore(value?: Connection): Promise<Connection | null> {
  const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) return null;
  const sql = postgres(url, { ssl: "require", prepare: false, max: 1 });
  try {
    await sql`CREATE TABLE IF NOT EXISTS crm_meta_social_connection (id TEXT PRIMARY KEY, encrypted TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    await sql`ALTER TABLE crm_meta_social_connection ENABLE ROW LEVEL SECURITY`;
    if (value) {
      const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv);
      const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
      const payload = [iv, cipher.getAuthTag(), encrypted].map(v => v.toString("base64")).join(":");
      await sql`INSERT INTO crm_meta_social_connection (id, encrypted) VALUES ('primary', ${payload}) ON CONFLICT (id) DO UPDATE SET encrypted = EXCLUDED.encrypted, updated_at = NOW()`;
      return value;
    }
    const rows = await sql`SELECT encrypted FROM crm_meta_social_connection WHERE id = 'primary'`;
    if (!rows[0]) return null;
    const [iv, tag, encrypted] = String(rows[0].encrypted).split(":").map(v => Buffer.from(v, "base64"));
    const decipher = createDecipheriv("aes-256-gcm", key(), iv); decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8"));
  } finally { await sql.end(); }
}
