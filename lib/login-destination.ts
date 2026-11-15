// Preserve the intended page without allowing external or executable redirects.
export function loginDestination(value: string | null | undefined) {
  if (!value || value.length > 4096 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return "/admin";
  try {
    const url = new URL(value, "https://crm.local");
    const decodedPath = decodeURIComponent(url.pathname);
    if (url.origin !== "https://crm.local" || /[\\\u0000-\u001f\u007f]/.test(decodedPath) || !(decodedPath === "/admin" || decodedPath.startsWith("/admin/"))) return "/admin";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/admin"; }
}
