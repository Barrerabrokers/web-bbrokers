export const SITE_SETTINGS_ROLES = ["admin", "marketing"] as const;
export const ADMIN_PANEL_ROLES = ["admin", "marketing"] as const;
export const LISTING_MANAGER_ROLES = ["admin", "agent", "marketing"] as const;

export function canManageSiteSettings(role?: string | null) {
  return !!role && SITE_SETTINGS_ROLES.includes(role as any);
}

export function canManageAdminPanel(role?: string | null) {
  return !!role && ADMIN_PANEL_ROLES.includes(role as any);
}

export function canViewAllCrmContacts(role?: string | null) {
  return role === "admin";
}

export function canManageListings(role?: string | null) {
  return !!role && LISTING_MANAGER_ROLES.includes(role as any);
}

export function getRoleLabel(role?: string | null) {
  if (role === "admin") return "Admin";
  if (role === "marketing") return "Gerente de marketing";
  return "Agente";
}
