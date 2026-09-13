"use client";

import { useId } from "react";
import { CALL_OUTCOMES, type CallOutcome } from "@/lib/crm-call-outcomes";

export function CrmCallOutcomeChecklist({ value = [], onChange, disabled = false }: {
  value?: readonly string[];
  onChange: (value: CallOutcome[]) => void;
  disabled?: boolean;
}) {
  const groupName = useId();
  const selected = CALL_OUTCOMES.find((option) => value.includes(option));
  return (
    <fieldset disabled={disabled} className="mt-4 disabled:opacity-60">
      <legend className="text-sm font-semibold text-ink">Estado de la llamada</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {CALL_OUTCOMES.map((option) => (
          <label key={option} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${selected === option ? "border-[#006b6b] bg-[#e7f4f2] text-[#006b6b]" : "border-ink/15 bg-white text-ink hover:bg-[#f2f8f7]"}`}>
            <input type="radio" name={groupName} checked={selected === option}
              onChange={() => onChange([option])}
              className="h-4 w-4 accent-[#006b6b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006b6b]" />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
