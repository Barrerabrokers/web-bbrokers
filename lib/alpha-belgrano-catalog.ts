export const ALPHA_BELGRANO_SLUG = "alpha-place-belgrano";
export const ALPHA_BROCHURE = "https://drive.google.com/file/d/1yhd7DBosXjnYqEJccvHIRP5a-jc_Jmyf/view";
export const ALPHA_SHEET_CSV = "https://docs.google.com/spreadsheets/d/1INuGPpFYt9UcsDLke8h9sY5zFQ6gGcRluk7_rFIDh_8/export?format=csv&gid=876335053";

export interface AlphaUnit {
  number: string;
  id: string;
  floor: number;
  status: "disponible" | "reservada" | "vendida";
  plan: number;
  typology: string;
  orientation: string;
  covered: number;
  balcony: number;
  total: number;
  price: number;
  downPayment: number;
  installment: number;
}

export interface AlphaCatalog {
  units: AlphaUnit[];
  list: string;
  date: string;
  live: boolean;
}

/** CSV export contains quoted multiline headers and Argentine formatted numbers. */
export function parseAlphaCsv(csv: string): AlphaCatalog {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') {
      if (quoted && csv[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n")) {
      row.push(field.replace(/\r$/, "")); field = "";
      if (c === "\n") { rows.push(row); row = []; }
    } else field += c;
  }
  if (quoted) throw new Error("CSV incompleto");
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const header = rows.findIndex(r => r[2]?.trim() === "DESIGNACION" && r[4]?.trim() === "ESTADO");
  if (header < 0) throw new Error("Estructura de lista desconocida");
  const num = (v: string) => !v || v.trim() === "-" ? 0 : Number((v || "").replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  const units: AlphaUnit[] = [];
  for (const r of rows.slice(header + 1)) {
    if (!/^\d{3,4}$/.test(r[2]?.trim() || "")) continue;
    const status = { Disponible: "disponible", Reservado: "reservada", Reservada: "reservada", Vendido: "vendida", Vendida: "vendida" }[r[4]?.trim()] as AlphaUnit["status"] | undefined;
    if (!status) throw new Error("Estado de unidad desconocido");
    const unit: AlphaUnit = {
      number: r[2].trim(), id: r[3].trim(), floor: num(r[1]), status, plan: num(r[5]),
      typology: r[6]?.trim().toUpperCase() === "STUDIO" ? "Studio" : `${r[6]} dormitorios`,
      orientation: r[7], covered: num(r[8]), balcony: num(r[9]), total: num(r[10]),
      price: num(r[11]), downPayment: num(r[12]), installment: num(r[13]),
    };
    if (status === "disponible" && (!Number.isFinite(unit.price) || unit.price <= 0 || !Number.isFinite(unit.total) || unit.total <= 0 || !Number.isFinite(unit.covered) || unit.covered <= 0 || !Number.isFinite(unit.balcony) || !Number.isFinite(unit.floor) || !Number.isFinite(unit.downPayment) || !Number.isFinite(unit.installment))) throw new Error("Unidad disponible con datos incompletos");
    if (units.some(u => u.number === unit.number)) throw new Error("Unidad duplicada");
    units.push(unit);
  }
  if (!units.length) throw new Error("Lista vacía");
  return { units, list: rows[0]?.[11]?.trim() || "Lista de precios", date: rows[0]?.[13]?.trim() || "Fecha no informada", live: true };
}

export function alphaPlan(unit: AlphaUnit) {
  // These are the two plans actually verified against the supplied brochure.
  if ((unit.plan === 2 && ["201", "301", "401", "501", "601", "701"].includes(unit.number)) || (unit.plan === 4 && ["203", "303", "403", "503", "603"].includes(unit.number))) {
    return `/developments/alpha-place-belgrano/plano-${unit.plan}.webp`;
  }
  return undefined;
}

export function alphaPlanNote(unit: AlphaUnit) {
  return unit.number === "701" ? "La lista informa 54 m² (47 cubiertos + 7 de balcón). El plano genérico #2 indica 53 m²; confirmar la diferencia con el desarrollador." : undefined;
}

export function alphaMoney(amount: number) {
  return `US$ ${amount.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

export function alphaShareText(unit: AlphaUnit, catalog: Pick<AlphaCatalog, "list" | "date" | "live">, origin: string) {
  const link = new URL(`/desarrollos/${ALPHA_BELGRANO_SLUG}`, origin);
  link.searchParams.set("unidad", unit.number);
  link.hash = "unidades";
  const plan = alphaPlan(unit);
  return [
    `Alpha Place Belgrano · Unidad ${unit.number}`,
    "Manuel Ugarte 1576 · Belgrano, CABA",
    `${unit.typology} · Piso ${unit.floor}° · ${unit.orientation}`,
    `${unit.total} m² propios (${unit.covered} m² cubiertos + ${unit.balcony} m² de balcón)`,
    `Precio de lista: ${alphaMoney(unit.price)}`,
    ...(unit.downPayment > 0 ? [`Anticipo: ${alphaMoney(unit.downPayment)}`] : []),
    ...(unit.installment > 0 ? [`24 cuotas de ${alphaMoney(unit.installment)}`] : []),
    `${catalog.list} · ${catalog.date}. Precio y disponibilidad sujetos a confirmación.`,
    ...(!catalog.live ? ["No se pudo consultar la lista en línea; estos datos corresponden a la última lista de referencia."] : []),
    ...(alphaPlanNote(unit) ? [alphaPlanNote(unit)!] : []),
    `Ficha: ${link.href}`,
    ...(plan ? [`Plano: ${new URL(plan, origin).href}`] : []),
    `Brochure: ${ALPHA_BROCHURE}`,
    "Barrera Brokers",
  ].join("\n");
}
