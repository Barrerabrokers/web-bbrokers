// This policy only limits recovery scans. It never deletes or changes existing
// CRM contacts, their history, or manual imports supplied by another agency.
export function getExcludedMetaRecoveryFormIds(): Set<string> {
  return new Set(
    (process.env.META_LEAD_RECOVERY_EXCLUDED_FORM_IDS || "")
      .split(",")
      .map(id => id.trim())
      .filter(id => /^\d+$/.test(id))
  );
}
