import { z } from "zod";

export const catalogOrderSchema = z.object({
  kind: z.enum(["properties", "developments"]),
  version: z.array(z.string().uuid()).max(10000),
  ids: z.array(z.string().uuid()).max(10000),
}).superRefine((data, context) => {
  const expected = new Set(data.version);
  if (new Set(data.ids).size !== data.ids.length || expected.size !== data.version.length || data.ids.length !== data.version.length || data.ids.some(id => !expected.has(id))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Incluí cada ficha una sola vez, sin agregar ni quitar elementos." });
  }
});
export type CatalogOrderInput = z.infer<typeof catalogOrderSchema>;
export function catalogOrderMatches(current: string[], expected: string[]) {
  return current.length === expected.length && current.every((id, index) => id === expected[index]);
}
