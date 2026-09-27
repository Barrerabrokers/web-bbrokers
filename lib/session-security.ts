import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_MAX_SECONDS = 8 * 60 * 60;
type Account = { id: string; password: string; role: string; active: boolean; email: string; sessionVersion?: number };
export function accountSessionProof(account: Account, secret: string) {
  if (!secret) throw new Error("Missing session secret");
  return createHmac("sha256", secret).update(JSON.stringify([account.id, account.password, account.role, account.active, account.email, account.sessionVersion || 0])).digest("hex");
}
export function validAccountSession(token: { id?: unknown; sessionIssuedAt?: unknown; sessionProof?: unknown }, account: Account | null, secret: string, now = Date.now()) {
  if (!account?.active || token.id !== account.id || typeof token.sessionIssuedAt !== "number" || typeof token.sessionProof !== "string") return false;
  const age = now - token.sessionIssuedAt;
  if (age < 0 || age >= SESSION_MAX_SECONDS * 1000 || !/^[a-f0-9]{64}$/.test(token.sessionProof)) return false;
  return timingSafeEqual(Buffer.from(token.sessionProof,"hex"), Buffer.from(accountSessionProof(account,secret),"hex"));
}
