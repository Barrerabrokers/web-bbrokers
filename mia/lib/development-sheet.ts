import * as XLSX from 'xlsx';

export const PROJECT_SHEET_ID = '1ETOspJQfcnAVvjGp7mJ2Qx5TNXDQsYG88A9GRSPClMA';
const normalize = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export type SheetProject = {
  id: string; name: string; address: string; location: string;
  delivery: string | null; listUrl: string | null; brochure_url: string | null;
};
export type SheetUnit = {
  project: SheetProject; unit: string | null; originalType: string | null;
  roomCount: number | null; price: string | null; currency: string; availability: string | null;
  totalArea: string | null; areaLabel?: 'propios'; downPayment: string | null;
  installments: { count: number; amount: string; frequency: string | null } | null;
};

function https(value: string | undefined) {
  try {
    const url = new URL(value ?? '');
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function sheetId(link: string | null) {
  if (!link) return null;
  const url = new URL(link);
  return url.hostname === 'docs.google.com'
    ? /^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/.exec(url.pathname)?.[1] ?? null
    : null;
}

export async function readDevelopmentWorkbook(id: string) {
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export?format=xlsx`, {
    signal: AbortSignal.timeout(18000), cache: 'no-store',
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('spreadsheetml')) {
    throw new Error('Development worksheet unavailable');
  }
  return XLSX.read(await response.arrayBuffer(), {type: 'array'});
}

function rows(workbook: XLSX.WorkBook) {
  return workbook.SheetNames.flatMap(name => {
    const sheet = workbook.Sheets[name];
    if (!sheet['!ref']) return [];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    return XLSX.utils.sheet_to_json<string[]>(sheet, {header: 1, raw: false, defval: '', blankrows: true})
      .map((values, index) => ({
        values,
        cell: (column: number) => sheet[XLSX.utils.encode_cell({r: range.s.r + index, c: range.s.c + column})] as XLSX.CellObject | undefined,
      }));
  });
}

function deliveryValue(value: string) {
  const months = /^(\d+)\s*(?:mes(?:es)?|months?)$/i.exec(value.trim());
  if (/^0$|^(?:entrega )?inmediata$|^immediate(?: delivery)?$/i.test(value.trim())) return '0 meses';
  return months ? `${months[1]} meses` : value.trim();
}

export function deliveryMonths(value: string | null) {
  const match = /^(\d{1,4}) meses$/.exec(value ? deliveryValue(value) : '');
  return match ? Number(match[1]) : null;
}

function brochureFile(value: string | undefined) {
  const href = https(value);
  if (!href) return null;
  const url = new URL(href);
  if (url.hostname === 'drive.google.com') {
    return /^\/file\/d\/[A-Za-z0-9_-]+(?:\/|$)/.test(url.pathname) ? href : null;
  }
  if (url.hostname === 'docs.google.com') {
    return /^\/(?:document|presentation)\/d\/[A-Za-z0-9_-]+(?:\/|$)/.test(url.pathname) ? href : null;
  }
  return /\.pdf$/i.test(url.pathname) ? href : null;
}

export function parseDevelopmentProjects(workbook: XLSX.WorkBook) {
  const catalog = new Map<string, {project: SheetProject; deliveries: Set<string>; lists: Set<string>; brochures: Set<string>}>();
  for (const {values, cell} of rows(workbook)) {
    const [name, address, location, , list, brochure, delivery] = values.map(value => String(value).trim());
    if (!name || /^(edificio|building)$/.test(normalize(name))) continue;
    const id = normalize(address || name);
    const current = catalog.get(id) ?? {
      project: {id, name, address: address ?? '', location: location ?? '', delivery: null, listUrl: null, brochure_url: null},
      deliveries: new Set<string>(), lists: new Set<string>(), brochures: new Set<string>(),
    };
    const listUrl = https(cell(4)?.l?.Target ?? list);
    const brochureUrl = brochureFile(cell(5)?.l?.Target ?? brochure);
    if (listUrl && sheetId(listUrl)) current.lists.add(listUrl);
    if (brochureUrl) current.brochures.add(brochureUrl);
    if (delivery && !/^[-\s]+$|^(?:n\/a|no confirmado)$/i.test(delivery)) current.deliveries.add(deliveryValue(delivery));
    catalog.set(id, current);
  }
  return [...catalog.values()].map(({project, deliveries, lists, brochures}) => ({
    ...project,
    delivery: deliveries.size === 1 ? [...deliveries][0] : null,
    listUrl: lists.size === 1 ? [...lists][0] : null,
    brochure_url: brochures.size === 1 ? [...brochures][0] : null,
  }));
}

export function normalizedRooms(value: string) {
  const text = normalize(value);
  if (/\b(?:2|dos) (?:amb|ambiente|ambientes)\b/.test(text)) return 2;
  if (/\b(?:studio|monoambiente|(?:1|un) (?:ambiente|ambientes|dormitorio|bed))\b/.test(text)) return 1;
  return null;
}

function positiveNumber(value: string) {
  let numeric = value.trim().replace(/^(?:[A-Z]{3}|U\$S|US\$|\$|€|£)\s*/i, '');
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(numeric)) numeric = numeric.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(numeric)) numeric = numeric.replace(/,/g, '');
  else numeric = numeric.replace(',', '.');
  const amount = Number(numeric);
  return /^\d+(?:\.\d+)?$/.test(numeric) && Number.isFinite(amount) && amount > 0 ? amount : null;
}

function money(value: string, currency: string) {
  const amount = positiveNumber(value);
  return amount === null ? null : `${currency} ${amount.toLocaleString('es-AR', {maximumFractionDigits: 2})}`;
}

export function parseDevelopmentUnits(workbook: XLSX.WorkBook, project: SheetProject): SheetUnit[] {
  return workbook.SheetNames.flatMap(name => {
    const sheet = workbook.Sheets[name];
    const values = XLSX.utils.sheet_to_json<string[]>(sheet, {header: 1, raw: false, defval: ''});
    const header = values.findIndex(row => row.some(value => /tipolog[ií]a|typology|ambientes|dormitorios|bedrooms/i.test(value))
      && row.some(value => /precio|\bprice\b/i.test(value)));
    if (header < 0) return [];
    const fields = values[header].map(normalize);
    const typeColumn = fields.findIndex(value => /tipologia|typology|ambientes|dormitorios|bedrooms/.test(value));
    const unitColumn = fields.findIndex(value => /\b(?:unidad|unit)\b/.test(value));
    const statusColumn = fields.findIndex(value => /estado|status|disponibilidad/.test(value));
    const priceColumn = fields.findIndex(value => /precio|\bprice\b/.test(value) && !/m2|m 2/.test(value));
    const currencyColumn = fields.findIndex(value => /moneda|currency/.test(value));
    const floorColumn = fields.findIndex(value => /piso|floor/.test(value));
    const totalColumn = fields.findIndex(value => /m ?2 totales|superficie total|total m ?2|total area|propia unidad m ?2|private area per unit/.test(value));
    const downColumn = fields.findIndex(value => /anticipo|down payment/.test(value));
    const installmentColumn = fields.findIndex(value => /cuota|installment/.test(value) && !/forma de pago|cantidad|number of/.test(value));
    const countColumn = fields.findIndex(value => /cantidad.*cuotas|numero.*cuotas|number of installments/.test(value));
    const frequencyColumn = fields.findIndex(value => /frecuencia|frequency|periodicidad/.test(value));
    const installmentHeader = values[header][installmentColumn] ?? '';
    const headerCount = Number(installmentHeader.match(/(?:\bx\s*|\b)(\d+)\s*(?:cuotas|installments|\))/i)?.[1] ?? 0);
    return values.slice(header + 1).flatMap(row => {
      const unit = row[unitColumn]?.trim() || null;
      const originalType = row[typeColumn]?.trim() || null;
      const availability = row[statusColumn]?.trim() || null;
      if (!unit && !originalType && !availability) return [];
      const rawPrice = row[priceColumn]?.trim() ?? '';
      const priceContext = [rawPrice, values[header][priceColumn], row[currencyColumn]].join(' ');
      const currency = /\bARS\b/i.test(priceContext) ? 'ARS' :
        /\bEUR\b|€/i.test(priceContext) ? 'EUR' :
        /\bGBP\b|£/i.test(priceContext) ? 'GBP' :
        /\b(?:UYU|BRL|CLP|MXN|CAD|CHF|PYG|BOB|COP|PEN)\b/i.exec(priceContext)?.[0].toUpperCase() ??
        (/^[A-Z]{3}$/i.test(row[currencyColumn]?.trim() ?? '') ? row[currencyColumn].trim().toUpperCase() : 'USD');
      const price = money(rawPrice, currency);
      const total = positiveNumber(row[totalColumn] ?? '');
      const downPayment = /%/.test(row[downColumn] ?? '') ? null : money(row[downColumn] ?? '', currency);
      const rawInstallment = row[installmentColumn] ?? '';
      const embedded = /^(\d+)\s+(?:cuotas|installments)\s+(?:de|of)\s+(.+?)(?:\s+(?:mensuales|monthly|trimestrales))?$/i.exec(rawInstallment.trim());
      const count = Number(row[countColumn] || embedded?.[1] || headerCount);
      const installmentAmount = money(embedded?.[2] ?? rawInstallment, currency);
      const frequencySource = [row[frequencyColumn], installmentHeader, rawInstallment].join(' ');
      const frequency = /mensual|monthly/i.test(frequencySource) ? 'mensuales' :
        /trimestral|quarterly/i.test(frequencySource) ? 'trimestrales' : null;
      const installments = Number.isInteger(count) && count > 0 && installmentAmount
        ? {count, amount: installmentAmount, frequency} : null;
      return [{project, unit: unit && row[floorColumn] ? `${row[floorColumn]}-${unit}` : unit,
        originalType, roomCount: originalType
          ? /^\d+$/.test(originalType) && /ambientes|dormitorios|bedrooms/.test(fields[typeColumn])
            ? Number(originalType) : normalizedRooms(originalType)
          : null, price, currency, availability,
        totalArea: total === null ? null : total.toLocaleString('es-AR', {maximumFractionDigits: 2}),
        areaLabel: /propia unidad|private area per unit/.test(fields[totalColumn] ?? '') ? 'propios' as const : undefined,
        downPayment, installments}];
    });
  });
}

export async function getDevelopmentProjects() {
  return parseDevelopmentProjects(await readDevelopmentWorkbook(PROJECT_SHEET_ID));
}

export function linkedDelivery(workbook: XLSX.WorkBook) {
  const deliveries = new Set<string>();
  for (const {values} of rows(workbook)) {
    const cells = values.map(value => String(value).trim());
    for (let index = 0; index < cells.length; index++) {
      const label = cells[index];
      if (!/^(?:fecha (?:estimada )?de entrega|entrega (?:estimada|prevista)|tiempo de entrega|delivery date|estimated delivery)\b/i.test(label)) continue;
      const value = label.split(':').slice(1).join(':').trim() || cells[index + 1];
      if (value && /\d/.test(value)) deliveries.add(deliveryValue(value));
    }
  }
  return deliveries.size === 1 ? [...deliveries][0] : null;
}

export async function loadAvailableSheetUnits(projects: SheetProject[], zone: string,
  saveList?: (projectId: string, units: SheetUnit[]) => Promise<void>,
  onUnavailable?: (project: SheetProject) => Promise<void>, allowUnconfirmedDelivery = false) {
  const nearby = zone === 'nunez' ? ['nunez', 'belgrano'] : [zone];
  const candidates = projects.filter(project => nearby.includes(normalize(project.location)))
    .sort((a,b) => Number(normalize(b.location) === zone) - Number(normalize(a.location) === zone));
  const lists = await Promise.allSettled(candidates.map(async project => {
    const id = sheetId(project.listUrl);
    if (!id) return null;
    const workbook = await readDevelopmentWorkbook(id);
    return parseDevelopmentUnits(workbook, {...project, delivery: project.delivery ?? linkedDelivery(workbook)});
  }));
  const available: SheetUnit[] = [];
  for (const [index, result] of lists.entries()) {
    const project = candidates[index];
    if (result.status !== 'fulfilled' || !result.value) {
      await onUnavailable?.(project);
      continue;
    }
    await saveList?.(project.id, result.value);
    available.push(...result.value.filter(unit => unit.project.address && (unit.project.delivery || allowUnconfirmedDelivery) && unit.unit && unit.totalArea && unit.price && unit.availability &&
      /^(?:disponible|available)(?:\s*\/\s*(?:disponible|available))?$/i.test(unit.availability)));
  }
  return available;
}

export async function getVerifiedSheetOptions(projects: SheetProject[], zone: string, rooms: number[],
  saveList?: (projectId: string, units: SheetUnit[]) => Promise<void>,
  onUnavailable?: (project: SheetProject) => Promise<void>) {
  const available = await loadAvailableSheetUnits(projects, zone, saveList, onUnavailable);
  return rooms.flatMap(room => {
    const match = available.find(unit => unit.roomCount === room);
    return match ? [match] : [];
  });
}
