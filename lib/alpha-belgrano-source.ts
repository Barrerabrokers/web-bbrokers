import { readFile } from "node:fs/promises";
import path from "node:path";
import { ALPHA_SHEET_CSV, parseAlphaCsv, type AlphaCatalog } from "./alpha-belgrano-catalog";

export async function getAlphaBelgranoCatalog(): Promise<AlphaCatalog> {
  try {
    const response = await fetch(ALPHA_SHEET_CSV, { next: { revalidate: 300 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Lista HTTP ${response.status}`);
    return parseAlphaCsv(await response.text());
  } catch {
    // A dated, visibly identified reference is safer than silently showing stale availability.
    const snapshot = await readFile(path.join(process.cwd(), "data/alpha-place-belgrano-prices.csv"), "utf8");
    return { ...parseAlphaCsv(snapshot), live: false };
  }
}
