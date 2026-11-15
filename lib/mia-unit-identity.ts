/** UF is a label for unidad funcional, not a different apartment identifier. */
export function canonicalMiaUnit(value:unknown) {
  return String(value??'').trim().replace(/^(?:UF|U\.F\.)\s*[:#-]?\s*(?=\d)/i,'').toUpperCase();
}
