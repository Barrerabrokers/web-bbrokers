export function hasGoogleCalendarAccess(account: { provider?: string; googleScopes?: string } | null | undefined) {
  const scopes = new Set(account?.googleScopes?.split(/\s+/));
  return account?.provider === "google-oauth" && (
    scopes.has("https://www.googleapis.com/auth/calendar") ||
    scopes.has("https://www.googleapis.com/auth/calendar.events")
  );
}
