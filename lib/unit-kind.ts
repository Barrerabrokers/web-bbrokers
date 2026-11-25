/** Parking is explicitly named; zero bedrooms alone still means a studio. */
export function isParkingUnit(unit: { unitNumber: string }): boolean {
  return /^cochera(?:\s|$)/i.test(unit.unitNumber.trim());
}

/** Explicit ancillary inventory must not be advertised as residential rooms. */
export function accessoryUnitLabel(unit: { unitNumber: string }): string | null {
  const name = unit.unitNumber.trim();
  if (/^cochera(?:\s|$)/i.test(name)) return "Cochera";
  if (/^baulera(?:\s|$)/i.test(name)) return "Baulera";
  if (/^cabana(?:\s|$)/i.test(name)) return "Cabana privada";
  return null;
}
export function isAccessoryUnit(unit: { unitNumber: string }): boolean {
  return accessoryUnitLabel(unit) !== null;
}
