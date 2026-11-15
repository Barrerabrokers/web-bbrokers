import { canonicalMiaUnit } from '@/lib/mia-unit-identity';
import { getMiaSourceValidityConfirmations, confirmedMiaLegacyExpiry } from '@/lib/mia-source-confirmations';
import { createHash } from 'crypto';
import { loadSalesDocument, readSalesResource, selectSalesProjects } from '@/lib/whatsapp-sales-catalog';
import { extractVerifiedPaymentRows } from '@/lib/whatsapp-sales-offers';
import { hasMiaValues } from '@/lib/whatsapp-mia-safety';
import { isMiaSourceUrl, type MiaSources } from '@/lib/whatsapp-mia-sources-config';

type Cell = { value: unknown; formatted?: string; link?: string };
export type MiaSourceTable = { title: string; rows: Cell[][]; text: string; url: string };
export type MiaVerifiedQuote = {
  token: string; project: string; unit: string; floor?: string; rooms?: number; area?: string;
  price: number; currency: 'USD' | 'ARS'; originalBudget?: number; down?: number; months?: number; installment?: number;
  adjustment?: string; source: string; row: number; readAt: string;
};
export type MiaSourceContext = { references: { title: string; url: string; text: string }[]; quotes: MiaVerifiedQuote[]; issues: string[] };
const normal = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const cache = new Map<string, { expires: number; promise: Promise<MiaSourceTable> }>();

function decodeHtml(text: string) {
  return text.replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value))).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
}
export async function readSource(url: string): Promise<MiaSourceTable> {
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const promise = (async () => {
    if (new URL(url).hostname === 'docs.google.com') {
      // HTML supplies the selected tab title; XLSX preserves cell links and explicit currency formats.
      const [file, page] = await Promise.all([readSalesResource(url, 'xlsx'), readSalesResource(url, 'sheetHtml')]);
      const title = decodeHtml(page.buffer.toString('utf8').match(/<title>([^<]*)<\/title>/i)?.[1] || '').trim();
      if (!title || !page.type.includes('html')) throw new Error('No se pudo identificar la hoja seleccionada.');
      const XLSX = await import('xlsx');
      const book = XLSX.read(file.buffer, { type: 'buffer', cellNF: true });
      const sheet = book.Sheets[title];
      if (!sheet || !sheet['!ref']) throw new Error('La hoja seleccionada no está disponible.');
      const range = XLSX.utils.decode_range(sheet['!ref']);
      if (range.e.r > 10000 || range.e.c > 100) throw new Error('La hoja excede el tamaño admitido.');
      const rows: Cell[][] = [];
      for (let row = 0; row <= range.e.r; row++) {
        rows.push(Array.from({ length: range.e.c + 1 }, (_, col) => {
          const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
          return { value: cell?.t === 'e' ? '' : cell?.v ?? '', formatted: cell?.w, link: cell?.l?.Target };
        }));
      }
      return { title, rows, text: rows.map(row => row.map(cell => String(cell.value)).join('\t')).filter(line => line.trim()).join('\n'), url };
    }
    const doc = await loadSalesDocument(url, 'priceList');
    if (!('text' in doc) || !doc.text) throw new Error('Documento sin acceso o sin texto legible.');
    return { title: String(doc.text).split('\n').find(line => line.trim())?.trim().slice(0, 120) || 'Documento comercial', rows: [], text: doc.text, url };
  })();
  if (cache.size >= 40) cache.delete(cache.keys().next().value!);
  cache.set(url, { expires: Date.now() + 60_000, promise });
  try { return await promise; } catch (error) { cache.delete(url); throw error; }
}

function quoteToken(url: string, row: number) { return `[[MIA_COTIZACION:${createHash('sha256').update(url + ':' + row).digest('hex').slice(0, 16)}]]`; }
function positive(value: unknown) { return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined; }
function explicitCurrency(text: string): 'USD' | 'ARS' | undefined {
  const usd = /\busd\b|us\$|u\$s|dolares/.test(normal(text));
  const ars = /\bars\b|pesos/.test(normal(text));
  return usd === ars ? undefined : usd ? 'USD' : 'ARS';
}
export function sourceValidity(text: string, now = new Date(), confirmedLegacyExpiry?: string) {
  const match = normal(text).match(/(?:vigente hasta(?: el)?|vigencia hasta(?: el)?|valid through)\s*:?\s*(\d{1,2})[\-/](\d{1,2})[\-/](\d{4})/);
  if (!match) return !/(?:vigente hasta|vigencia hasta|valid through)/.test(normal(text));
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 23, 59, 59));
  if(confirmedLegacyExpiry===`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`)return true;
  return date.getUTCDate() === Number(day) && date.getUTCMonth() === Number(month) - 1 && (date.getTime() >= now.getTime() || confirmedLegacyExpiry===`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`);
}

/** Extract only complete, explicitly available rows. A nearby amount is never a unit's price. */
export function verifiedSheetQuotes(table: MiaSourceTable, project: string, declaredCurrency?: 'USD', confirmedLegacyExpiry?: string): MiaVerifiedQuote[] {
  if (!sourceValidity(table.text,new Date(),confirmedLegacyExpiry)) return [];
  const headerRow = table.rows.findIndex(row => row.some(c => /^(unidad|unit)(?:\s|\/|$)/.test(normal(c.value))) && row.some(c => /estado|status/.test(normal(c.value))));
  if (headerRow < 0) return [];
  const headers = table.rows[headerRow].map(cell => normal(cell.value));
  const find = (test: RegExp) => headers.findIndex(value => test.test(value));
  const unit = find(/^(unidad|unit)(?:\s|\/|$)/), status = find(/estado|status/);
  const price = headers.findIndex(value => /precio|price|valor unidad|^valor\s*(?:\/|$)/.test(value) && !/m[²2]|anticipo|cuota|down|installment/.test(value));
  if ([unit, status, price].some(index => index < 0)) return [];
  const floor = find(/^piso|^floor/), area = find(/propia\/unidad|total m|m[²2] totales|m[²2] propios/);
  const rooms = find(/^amb|rooms|tipologia|descripcion|description/), beds = find(/dormitorio|beds|bedrooms/), down = find(/anticipo|down payment/), monthly = find(/cuota|installment/), currencyCol = find(/^moneda|^currency/);
  const months = Number(headers[monthly]?.match(/x\s*(\d+)/)?.[1] || table.text.match(/(?:\+\s*|y\s+)(\d{1,3})\s*(?:cuotas|installments)/i)?.[1]);
  const uncertainCurrency = /no especifica moneda|does not specify a currency/i.test(table.text);
  const adjustment = /\bCAC\b/i.test(table.text) ? (/pesificad|converted to pesos/i.test(table.text) ? 'Cuotas pesificadas al tipo de cambio de reserva y ajustadas por CAC; el importe es de referencia, no una cuota fija.' : 'Cuotas ajustadas por CAC; confirmar moneda y valor actualizado con el asesor.') : undefined;
  const quotes: MiaVerifiedQuote[] = table.rows.flatMap((row, index) => {
    if (index <= headerRow || !/^(?:disponible|libre|available)(?:\s|\/|$)/.test(normal(row[status]?.value))) return [];
    const number = canonicalMiaUnit(row[unit]?.value), amount = positive(row[price]?.value);
    const currencyText = String(row[currencyCol]?.value || '') || String(row[price]?.formatted || '') + ' ' + headers[price];
    const contradictsDeclaration = declaredCurrency && /\bars\b|pesos|euros|\beur\b/i.test(normal(currencyText));
    const money = contradictsDeclaration ? undefined : uncertainCurrency && !declaredCurrency ? undefined : explicitCurrency(currencyText) || declaredCurrency;
    if (!number || /local|cochera|garage|oficina|office|^-$/.test(normal(number)) || !amount || !money) return [];
    const advance = positive(row[down]?.value), installment = positive(row[monthly]?.value);
    const planCurrency = explicitCurrency(String(row[monthly]?.formatted || '') + ' ' + headers[monthly]) || declaredCurrency;
    const advanceCurrency = explicitCurrency(String(row[down]?.formatted || '') + ' ' + headers[down]) || declaredCurrency;
    const consistentPlan = planCurrency === money && advanceCurrency === money && advance && installment && Number.isInteger(months) && months > 0 && months <= 120 && advance < amount && Math.abs(amount - advance - installment * months) <= months * .51 + 1;
    return [{ token: quoteToken(table.url, index + 1), project, unit: number, floor: floor >= 0 ? String(row[floor]?.value ?? '') : undefined,
      rooms: rooms >= 0 ? Number(normal(row[rooms]?.value).match(/^[123]\b/)?.[0] || (/mono|studio/.test(normal(row[rooms]?.value)) ? 1 : 0)) || undefined : /studio|mono/.test(normal(row[beds]?.value)) ? 1 : undefined,
      area: area >= 0 && positive(row[area]?.value) ? `${row[area].value} m² (${String(table.rows[headerRow][area].value).trim()})` : undefined,
      price: amount, currency: money, ...(consistentPlan ? { down: advance, months, installment, adjustment } : {}), source: table.url, row: index + 1, readAt: new Date().toISOString() }];
  });
  return quotes.filter(quote => table.rows.slice(headerRow + 1).filter(row => canonicalMiaUnit(row[unit]?.value) === canonicalMiaUnit(quote.unit) && (floor<0 || normal(row[floor]?.value)===normal(quote.floor))).length === 1)
    .map(quote=>{
      const repeated=table.rows.slice(headerRow+1).filter(row=>canonicalMiaUnit(row[unit]?.value)===canonicalMiaUnit(quote.unit)).length>1;
      return repeated&&/^\d+$/.test(quote.floor||'')&&/^[a-z0-9]{1,2}$/i.test(quote.unit)?{...quote,unit:String(Number(quote.floor))+(/^\d+$/.test(quote.unit)?quote.unit.padStart(2,'0'):quote.unit.toUpperCase())}:quote;
    });
}

function indexProjects(table: MiaSourceTable, kind: 'brochuresUrl' | 'priceListsUrl') {
  const header = table.rows.findIndex(row => row.some(cell => /^(edificio|building|proyecto|desarrollo)$/.test(normal(cell.value))));
  if (header < 0) return [];
  const headers = table.rows[header].map(cell => normal(cell.value));
  const name = headers.findIndex(h => /^(edificio|building|proyecto|desarrollo)$/.test(h));
  const link = headers.findIndex(h => kind === 'brochuresUrl' ? /brochure|folleto/.test(h) : /lista de precios|list price|price list/.test(h));
  const zone = headers.findIndex(h => /barrio|neighborhood/.test(h));
  return table.rows.slice(header + 1).flatMap(row => {
    const title = String(row[name]?.value || '').trim(), url = row[link]?.link || String(row[link]?.value || '');
    return title && isMiaSourceUrl(url) ? [{ name: title, slug: normal(title).replaceAll(' ', '-'), neighborhood: String(row[zone]?.value || ''), url }] : [];
  });
}

export async function loadMiaSourceContext(sources: MiaSources, query: string): Promise<MiaSourceContext> {
  const context: MiaSourceContext = { references: [], quotes: [], issues: [] };
  const confirmations=await getMiaSourceValidityConfirmations().catch(()=>[]);
  await Promise.all((['brochuresUrl', 'priceListsUrl'] as const).map(async kind => {
    const url = sources.projectsUrl;
    if (!url) return;
    try {
      const table = await readSource(url), projects = indexProjects(table, kind);
      const items = selectSalesProjects(projects, query).map(item => ({ name: item.project.name, url: item.project.url }));
      if (!projects.length) context.issues.push(`La planilla no tiene enlaces identificables a ${kind === 'brochuresUrl' ? 'brochures' : 'listas de precios'} por desarrollo.`);
      if (projects.length) context.references.push({ title: 'Índice de desarrollos', url, text: projects.map(p => `${p.name}: ${p.neighborhood}`).join('\n') });
      for (const item of items.slice(0, 2)) {
        try {
          const doc = item.url === url ? table : await readSource(item.url);
          if (kind === 'priceListsUrl') {
            const quotes = doc.rows.length ? verifiedSheetQuotes(doc, item.name, 'USD',confirmedMiaLegacyExpiry(doc.url,confirmations)) : sourceValidity(doc.text,new Date(),confirmedMiaLegacyExpiry(doc.url,confirmations)) ? extractVerifiedPaymentRows(doc.text).map(row => { const line = doc.text.split(/\r?\n/).findIndex(value => value.trim() === row.sourceRow) + 1; return { token: quoteToken(doc.url, line), project: item.name, unit: row.unit, rooms: row.rooms, price: row.price, currency: 'USD' as const, down: row.downPayment, months: row.months, installment: row.monthlyPayment, adjustment: /\bCAC\b/i.test(doc.text) ? 'Cuotas sujetas a CAC según la fuente; moneda de pago y valores finales a confirmar con el asesor.' : undefined, source: doc.url, row: line, readAt: new Date().toISOString() }; }) : [];
            context.quotes.push(...quotes);
            if (!quotes.length) context.issues.push(`${item.name}: no hay filas completas verificables para informar importes.`);
          } else {
            context.references.push({ title: item.name, url: doc.url, text: doc.text.split('\n').filter(line => !hasMiaValues(line)).slice(0, 50).join('\n').slice(0, 2200) });
          }
        } catch { context.issues.push(`${item.name}: documento sin acceso o no legible.`); }
      }
    } catch { context.issues.push(`${kind === 'brochuresUrl' ? 'Brochures' : 'Listas de precios'}: fuente sin acceso o no legible.`); }
  }));
  context.references = context.references.reduce<MiaSourceContext['references']>((refs, ref) => {
    const previous = refs.find(item => item.url === ref.url);
    if (previous) previous.text = [...new Set((previous.text + '\n' + ref.text).split('\n'))].join('\n');
    else refs.push(ref);
    return refs;
  }, []);
  context.issues = [...new Set(context.issues)];
  return context;
}

/** These amounts are rendered by the server after validating the model's non-financial response. */
export function renderMiaQuote(quote: MiaVerifiedQuote) {
  const amount = (value: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value);
  return [`${quote.project} · Unidad ${quote.unit}`, quote.floor ? `Piso: ${quote.floor}` : '', quote.area ? `Superficie: ${quote.area}` : '',
    `Precio de lista: ${quote.currency} ${amount(quote.price)}`, quote.originalBudget && quote.price > quote.originalBudget ? `Supera tu presupuesto original en ${quote.currency} ${amount(quote.price - quote.originalBudget)} (${amount((quote.price / quote.originalBudget - 1) * 100)} %).` : '',
    quote.down && quote.months && quote.installment ? `Anticipo: ${quote.currency} ${amount(quote.down)}. ${quote.months} cuotas de referencia de ${quote.currency} ${amount(quote.installment)}. ${quote.adjustment || 'Ajuste y condiciones finales a confirmar con el asesor.'}` : 'Financiación: requiere confirmación del asesor.',

    'Disponibilidad según la lista consultada; el asesor confirma vigencia, disponibilidad y condiciones antes de reservar.'].filter(Boolean).join('\n');
}

export function selectMiaQuoteCandidates(quotes: MiaVerifiedQuote[], query: string, budget?: string) {
  const text = normal(query), wanted = text.match(/(?:unidad|uf|depto)\s*([\w-]+)/)?.[1];
  const room = /monoambiente/.test(text) ? 1 : Number(text.match(/\b([23])\s*ambientes?/)?.[1]) || undefined;
  // A down payment or monthly allowance is not a total purchase budget.
  if (budget && /anticipo|cuota|mensual/.test(normal(budget))) return [];
  const raw = budget?.match(/(?:USD|U\$S|US\$)\s*([\d.,]+)/i)?.[1];
  const total = raw ? Number(raw.replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.')) : undefined;
  if (budget && (!total || !Number.isFinite(total))) return [];
  return quotes.filter(q => (!wanted || normal(q.unit).replace(/^uf\s*/, '') === wanted.replace(/^uf\s*/, '')) && (wanted || !room || q.rooms === room) && (!total || q.currency === 'USD' && q.price <= total * 1.1))
    .sort((a, b) => Number(!!total && a.price > total) - Number(!!total && b.price > total) || a.price - b.price).slice(0, 2).map(q => ({ ...q, originalBudget: total }));
}
