export const CALL_OUTCOMES = ["Contactado", "No contesta", "Mal momento", "Volver a llamar"] as const;
export type CallOutcome = typeof CALL_OUTCOMES[number];

export function formatCallOutcomes(values: readonly string[] = []) {
  const selected = CALL_OUTCOMES.find((option) => values.includes(option));
  return selected ? `Estado: ${selected}` : "";
}
