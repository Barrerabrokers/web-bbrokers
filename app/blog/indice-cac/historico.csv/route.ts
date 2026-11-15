import { CAC_HISTORY } from "@/lib/cac";
export async function GET() {
  const lines = ["Periodo;Costo de construccion;Variacion mensual general (%);Materiales;Variacion mensual materiales (%);Mano de obra;Variacion mensual mano de obra (%);Provisorio;Fuente"];
  for (const row of CAC_HISTORY.rows) lines.push([row.period, row.general, row.generalMonthly, row.materials, row.materialsMonthly, row.labor, row.laborMonthly, row.provisional ? "Si" : "No", row.source].map(value => String(value).replace(/\./g, ",")).join(";"));
  return new Response("\uFEFF" + lines.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="indice-cac-2011-2026.csv"' } });
}
