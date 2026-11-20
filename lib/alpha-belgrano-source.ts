import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseAlphaCsv, type AlphaCatalog } from "./alpha-belgrano-catalog";

const ALPHA_SHEET_CSV = "https://docs.google.com/spreadsheets/d/1INuGPpFYt9UcsDLke8h9sY5zFQ6gGcRluk7_rFIDh_8/export?format=csv&gid=876335053";

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
