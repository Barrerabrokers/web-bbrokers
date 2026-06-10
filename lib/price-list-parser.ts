import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";

export type ParsedPriceListUnit = {
  unitNumber: string;
  floor?: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  balconyArea?: number;
  totalArea?: number;
  downPayment?: number;
  installmentCount?: number;
  installmentValue?: number;
  price: number;
  orientation?: string;
  status: "disponible" | "reservada" | "vendida";
  description?: string;
  features: string[];
};

type ParseResult = {
  units: ParsedPriceListUnit[];
  ignoredLines: string[];
  textLength: number;
};

export async function parsePriceListPdf(buffer: Buffer): Promise<ParseResult> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText({
      cellSeparator: "\t",
      pageJoiner: "\n",
      lineEnforce: true,
    });
    return parsePriceListText(result.text || "");
  } finally {
    await parser.destroy();
  }
}

export function parsePriceListExcel(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const text = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_csv(sheet, {
      FS: "\t",
      RS: "\n",
      blankrows: false,
    });
  }).join("\n");

  return parsePriceListText(text);
}

export function parsePriceListText(text: string): ParseResult {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const units: ParsedPriceListUnit[] = [];
  const ignoredLines: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const parsed = parseUnitLine(line);
    if (!parsed) {
      if (looksRelevant(line)) ignoredLines.push(line);
      continue;
    }

    const key = parsed.unitNumber.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    units.push(parsed);
  }

  return {
    units,
    ignoredLines: ignoredLines.slice(0, 30),
    textLength: text.length,
  };
}

function parseUnitLine(line: string): ParsedPriceListUnit | null {
  const price = extractPrice(line);
  if (!price) return null;

  const lineWithoutPrice = line.replace(price.raw, " ");
  const unitNumber = extractUnitNumber(lineWithoutPrice);
  const areaInfo = extractArea(lineWithoutPrice);

  if (!unitNumber || !areaInfo.area) return null;

  const status = extractStatus(line);
  const bedrooms = extractRooms(line);
  const bathrooms = extractBathrooms(line);
  const floor = extractFloor(line, unitNumber);
  const orientation = extractOrientation(line);
  const downPayment = extractLabeledMoney(line, [
    "anticipo",
    "boleto",
    "reserva",
  ]);
  const installmentCount = extractInstallmentCount(line);
  const installmentValue = extractInstallmentValue(line);

  return {
    unitNumber,
    floor,
    bedrooms,
    bathrooms,
    area: areaInfo.area,
    balconyArea: areaInfo.balconyArea,
    totalArea: areaInfo.totalArea,
    downPayment,
    installmentCount,
    installmentValue,
    price: price.value,
    orientation,
    status,
    description: "Importada desde lista de precios",
    features: [],
  };
}

function extractLabeledMoney(line: string, labels: string[]): number | undefined {
  const labelPattern = labels.join("|");
  const match = line.match(
    new RegExp(`(?:${labelPattern})\\D{0,18}(?:u\\$s|usd|us\\$|\\$)?\\s*([0-9][0-9.,\\s]{2,})`, "i")
  );
  if (!match) return undefined;
  return parseMoney(match[1]) || undefined;
}

function extractInstallmentCount(line: string): number | undefined {
  const match = line.match(/\b(\d{1,3})\s*(?:cuotas?|cts?)\b/i);
  if (!match) return undefined;
  const count = Number(match[1]);
  return Number.isFinite(count) ? count : undefined;
}

function extractInstallmentValue(line: string): number | undefined {
  const patterns = [
    /(?:cuota|cuotas|valor\s*cuota)\D{0,18}(?:u\$s|usd|us\$|\$)?\s*([0-9][0-9.,\s]{2,})/i,
    /(?:\d{1,3}\s*(?:cuotas?|cts?)\s*(?:de)?\s*)(?:u\$s|usd|us\$|\$)?\s*([0-9][0-9.,\s]{2,})/i,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (!match) continue;
    const value = parseMoney(match[1]);
    if (value) return value;
  }

  return undefined;
}

function extractPrice(line: string): { value: number; raw: string } | null {
  const patterns = [
    /\b(?:u\$s|usd|us\$|\$)\s*([0-9][0-9.,\s]{3,})\b/i,
    /\b([0-9][0-9.,\s]{3,})\s*(?:u\$s|usd|us\$)\b/i,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (!match) continue;
    const value = parseMoney(match[1]);
    if (value && value >= 1000) {
      return { value, raw: match[0] };
    }
  }

  return null;
}

function parseMoney(input: string): number | null {
  const digits = input.replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

function extractUnitNumber(line: string): string | null {
  const explicit = line.match(
    /\b(?:unidad|uf|depto|dpto|departamento|apto|apartamento)\s*[:#-]?\s*([A-Z]{0,3}\s*\d{1,4}\s*[A-Z]?|PB\s*[A-Z0-9-]*)\b/i
  );
  if (explicit) return cleanUnitNumber(explicit[1]);

  const cells = splitCells(line);
  for (const cell of cells) {
    const normalized = cleanUnitNumber(cell);
    if (
      /^(?:PB[A-Z0-9-]*|[A-Z]{0,3}\d{1,4}[A-Z]?|\d{1,2}[A-Z])$/i.test(
        normalized
      ) &&
      !/^(?:amb|m2|m²|usd|total|precio)$/i.test(normalized)
    ) {
      return normalized;
    }
  }

  const loose = line.match(/\b(PB\s*[A-Z0-9-]*|[A-Z]?\d{1,4}[A-Z])\b/i);
  return loose ? cleanUnitNumber(loose[1]) : null;
}

function cleanUnitNumber(value: string): string {
  return value.replace(/\s+/g, "").replace(/[.,;:]+$/g, "").toUpperCase();
}

function extractArea(line: string): {
  area: number | null;
  balconyArea?: number;
  totalArea?: number;
} {
  const explicitAreas = Array.from(
    line.matchAll(/(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:m2|m²|mts|metros)\b/gi)
  )
    .map((match) => parseDecimal(match[1]))
    .filter((value): value is number => !!value && value > 10 && value < 500);

  const totalMatch = line.match(
    /(?:total|sup\.?\s*total|superficie\s*total)\D{0,12}(\d{1,3}(?:[.,]\d{1,2})?)/i
  );
  const balconyMatch = line.match(
    /(?:balcon|balc[oó]n|terraza)\D{0,12}(\d{1,3}(?:[.,]\d{1,2})?)/i
  );

  const totalArea = totalMatch ? parseDecimal(totalMatch[1]) : undefined;
  const balconyArea = balconyMatch ? parseDecimal(balconyMatch[1]) : undefined;

  if (explicitAreas.length > 0) {
    const largest = Math.max(...explicitAreas);
    return {
      area: totalArea || largest,
      balconyArea: balconyArea || undefined,
      totalArea: totalArea || largest,
    };
  }

  const numericCandidates = splitCells(line)
    .map((cell) => parseDecimal(cell))
    .filter((value): value is number => !!value && value > 15 && value < 500);

  const inferred = numericCandidates.length > 0 ? Math.max(...numericCandidates) : null;
  return {
    area: totalArea || inferred,
    balconyArea: balconyArea || undefined,
    totalArea: totalArea || inferred || undefined,
  };
}

function parseDecimal(input: string): number | null {
  const cleaned = input.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;

  const comma = cleaned.lastIndexOf(",");
  const dot = cleaned.lastIndexOf(".");
  const decimalSeparator = comma > dot ? "," : ".";
  const normalized = cleaned
    .replace(new RegExp(`[^\\d${decimalSeparator}]`, "g"), "")
    .replace(decimalSeparator, ".");

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function extractRooms(line: string): number {
  if (/\bmono(?:ambiente)?\b/i.test(line)) return 0;
  const match = line.match(/\b(\d)\s*(?:amb|ambiente|ambientes)\b/i);
  if (match) return Math.max(0, Number(match[1]));

  const dorms = line.match(/\b(\d)\s*(?:dorm|dormitorio|dormitorios)\b/i);
  if (dorms) return Math.max(1, Number(dorms[1]) + 1);

  return 1;
}

function extractBathrooms(line: string): number {
  const match = line.match(/\b(\d)\s*(?:ba[ñn]o|ba[ñn]os)\b/i);
  return match ? Math.max(0, Number(match[1])) : 1;
}

function extractFloor(line: string, unitNumber: string): string | undefined {
  const explicit = line.match(/\b(?:piso|floor)\s*[:#-]?\s*(PB|\d{1,2})\b/i);
  if (explicit) return explicit[1].toUpperCase();

  if (/^PB/i.test(unitNumber)) return "PB";

  const numeric = unitNumber.match(/\d+/)?.[0];
  if (!numeric) return undefined;
  if (numeric.length >= 4) return String(Number(numeric.slice(0, -2)));
  if (numeric.length === 3) return String(Number(numeric.slice(0, 1)));
  if (numeric.length === 2 && /[A-Z]$/i.test(unitNumber)) return numeric.slice(0, 1);
  return undefined;
}

function extractOrientation(line: string): string | undefined {
  const match = line.match(
    /\b(frente|contrafrente|interno|lateral|norte|sur|este|oeste|noreste|noroeste|sudeste|sudoeste)\b/i
  );
  return match ? match[1].toLowerCase() : undefined;
}

function extractStatus(line: string): "disponible" | "reservada" | "vendida" {
  if (/\b(vendida|vendido|sold)\b/i.test(line)) return "vendida";
  if (/\b(reservada|reservado|reserva)\b/i.test(line)) return "reservada";
  return "disponible";
}

function splitCells(line: string): string[] {
  return line
    .split(/\t+|\s{2,}|\s+\|\s+/)
    .map((cell) => cell.trim())
    .filter(Boolean);
}

function looksRelevant(line: string): boolean {
  return /\b(unidad|uf|depto|dpto|amb|m2|m²|usd|u\$s|precio)\b/i.test(line);
}
