import crypto from "crypto";
import { getSharedDatabase, releaseSharedDatabase } from "@/lib/database-pool";

export function normalizeAllPriceListsUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 4096) throw new Error("Pegá un enlace válido de Google Drive o Google Sheets.");
  const trimmed = value.trim();
  if (!trimmed) return "";
  const url = new URL(trimmed);
  if (url.protocol !== "https:" || !["drive.google.com", "docs.google.com"].includes(url.hostname) || url.username || url.password) {
    throw new Error("Pegá un enlace de Google Drive o Google Sheets que empiece con https://.");
  }
  return url.href;
}

export async function getAllPriceListsUrl(): Promise<string> {
  const sql = getSharedDatabase();
  try {
    const [row] = await sql`SELECT url FROM crm_shared_documents WHERE key='all-price-lists'`;
    return row?.url || "";
  } finally { await releaseSharedDatabase(sql); }
}

export async function saveAllPriceListsUrl(url: string) {
  const sql = getSharedDatabase();
  try {
    await sql`INSERT INTO crm_shared_documents(key,url,updated_at) VALUES('all-price-lists',${url},NOW())
      ON CONFLICT(key) DO UPDATE SET url=EXCLUDED.url,updated_at=NOW()`;
  } finally { await releaseSharedDatabase(sql); }
}

export type SharedPriceList = { id:string; url:string; description:string };
export function normalizePriceListEntry(value:unknown): {url:string;description:string} {
  const data=value as Record<string,unknown>|null;
  if(!data||typeof data.url!=="string"||data.url.length>4096)throw new Error("Pegá un enlace válido que empiece con https://.");
  let url:URL;
  try{url=new URL(data.url.trim());}catch{throw new Error("Pegá un enlace válido que empiece con https://.");}
  if(url.protocol!=="https:"||url.username||url.password)throw new Error("Pegá un enlace válido que empiece con https://.");
  if(typeof data.description!=="string"||!data.description.trim()||data.description.trim().length>500)throw new Error("Ingresá una descripción de hasta 500 caracteres.");
  return {url:url.href,description:data.description.trim()};
}
async function ensurePriceListEntries(sql:ReturnType<typeof getSharedDatabase>) {
  await sql`CREATE TABLE IF NOT EXISTS crm_shared_documents(key TEXT PRIMARY KEY,url TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`ALTER TABLE crm_shared_documents ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`;
}
export async function getSharedPriceLists():Promise<SharedPriceList[]> {
  const sql=getSharedDatabase();
  try{await ensurePriceListEntries(sql);const rows=await sql`SELECT key,url,description FROM crm_shared_documents WHERE key LIKE 'price-list:%' ORDER BY updated_at DESC,key`;return rows.map(r=>({id:String(r.key),url:String(r.url),description:String(r.description)}));}
  finally{await releaseSharedDatabase(sql);}
}
export async function addSharedPriceList(entry:{url:string;description:string}):Promise<SharedPriceList> {
  const sql=getSharedDatabase(),id='price-list:'+crypto.randomUUID();
  try{await ensurePriceListEntries(sql);await sql`INSERT INTO crm_shared_documents(key,url,description,updated_at) VALUES(${id},${entry.url},${entry.description},NOW())`;return {id,...entry};}
  finally{await releaseSharedDatabase(sql);}
}

export async function removeSharedPriceList(id: string) {
  const sql = getSharedDatabase();
  try {
    await ensurePriceListEntries(sql);
    await sql`DELETE FROM crm_shared_documents WHERE key = ${id} AND key LIKE 'price-list:%'`;
  } finally {
    await releaseSharedDatabase(sql);
  }
}
