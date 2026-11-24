/** Parking is explicitly named; zero bedrooms alone still means a studio. */
export function isParkingUnit(unit: { unitNumber: string }): boolean {
  return /^cochera(?:\s|$)/i.test(unit.unitNumber.trim());
}
