import crypto from "crypto";

type ShareKind = "development" | "property" | "unit";

type SharePayload = {
  kind: ShareKind;
  id: string;
  v: 1;
};

function getSecret() {
  return (
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    "barrera-brokers-local-share-secret"
  );
}

function sign(value: string) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(value)
    .digest("base64url");
}

export function createShareToken(kind: ShareKind, id: string) {
  const payload = Buffer.from(
    JSON.stringify({ kind, id, v: 1 } satisfies SharePayload)
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function hasValidShareToken(
  token: string | null | undefined,
  kind: ShareKind,
  id: string
) {
  if (!token) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return false;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return false;

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as SharePayload;
    return parsed.v === 1 && parsed.kind === kind && parsed.id === id;
  } catch {
    return false;
  }
}

export function withShareParam(path: string, token?: string) {
  if (!token) return path;
  const hashIndex = path.indexOf("#");
  const base = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}share=${encodeURIComponent(token)}${hash}`;
}
