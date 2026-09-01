import type { CrmEmailAccountWithSecret } from "@/lib/db";

export const GOOGLE_CRM_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

export function getGoogleOAuthConfig(origin: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || `${origin.replace(/\/$/, "")}/api/crm/google/callback`;

  if (!clientId || !clientSecret) {
    throw new Error("Falta GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en las variables de entorno.");
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

export function buildGoogleOAuthUrl({
  origin,
  state,
}: {
  origin: string;
  state: string;
}) {
  const { clientId, redirectUri } = getGoogleOAuthConfig(origin);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CRM_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode({
  origin,
  code,
}: {
  origin: string;
  code: string;
}) {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig(origin);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code,
    }),
  });
  const data = (await response.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  } | null;

  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || "No se pudo conectar Google.");
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    scope: data.scope || "",
  };
}

export async function refreshGoogleAccessToken({
  origin,
  refreshToken,
}: {
  origin: string;
  refreshToken: string;
}) {
  const { clientId, clientSecret } = getGoogleOAuthConfig(origin);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = (await response.json().catch(() => null)) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  } | null;

  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || "No se pudo refrescar Google.");
  }

  return data.access_token;
}

export async function getGoogleUserInfo(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await response.json().catch(() => null)) as {
    email?: string;
    name?: string;
    error?: { message?: string };
  } | null;

  if (!response.ok || !data?.email) {
    throw new Error(data?.error?.message || "No se pudo leer el perfil de Google.");
  }

  return {
    email: data.email,
    name: data.name || "",
  };
}

export async function getAccessTokenForGoogleAccount({
  origin,
  account,
}: {
  origin: string;
  account: CrmEmailAccountWithSecret;
}) {
  if (account.provider !== "google-oauth") {
    throw new Error("La cuenta no esta conectada con Google OAuth.");
  }
  return refreshGoogleAccessToken({
    origin,
    refreshToken: account.smtpPassword,
  });
}
