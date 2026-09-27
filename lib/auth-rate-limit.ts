import postgres from "postgres";
import { createHmac } from "crypto";

// Shared across instances; identities are keyed hashes, not stored email addresses.
export async function allowLoginAttempt(email: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!secret || !url) return false;
  const sql = postgres(url,{ssl:"require",max:1,prepare:false});
  try {
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS auth_login_limits (
      key TEXT PRIMARY KEY, window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(), attempts INTEGER NOT NULL DEFAULT 1);
      ALTER TABLE auth_login_limits ENABLE ROW LEVEL SECURITY;
      REVOKE ALL ON auth_login_limits FROM PUBLIC, anon, authenticated;`);
    const key = createHmac("sha256",secret).update("login:"+email.trim().toLowerCase()).digest("hex");
    const [row] = await sql`INSERT INTO auth_login_limits(key) VALUES(${key}) ON CONFLICT(key) DO UPDATE SET
      attempts=CASE WHEN auth_login_limits.window_start<NOW()-INTERVAL '15 minutes' THEN 1 ELSE auth_login_limits.attempts+1 END,
      window_start=CASE WHEN auth_login_limits.window_start<NOW()-INTERVAL '15 minutes' THEN NOW() ELSE auth_login_limits.window_start END
      RETURNING attempts`;
    await sql`DELETE FROM auth_login_limits WHERE window_start<NOW()-INTERVAL '1 day'`;
    return row.attempts <= 10;
  } catch { return false; }
  finally { await sql.end(); }
}
