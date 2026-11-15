import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
export type MiaSourceValidityConfirmation={source:string;legacyExpiry:string;confirmedAt:string;evidence:string};
export function miaSourceIdentity(value:string) {
  try{const url=new URL(value),id=url.hostname==='docs.google.com'?url.pathname.match(/^\/spreadsheets\/d\/([\w-]+)/)?.[1]:undefined;const gid=url.searchParams.get('gid')||new URLSearchParams(url.hash.slice(1)).get('gid')||'0';return id&&/^\d+$/.test(gid)?id+':'+gid:undefined;}catch{return undefined;}
}
export async function getMiaSourceValidityConfirmations():Promise<MiaSourceValidityConfirmation[]> {
  const sql=getSharedDatabase();try{const [row]=await sql`SELECT value FROM crm_whatsapp_agent_settings WHERE key='mia-source-validity-confirmations-v1'`;const list=row?JSON.parse(row.value):[];return Array.isArray(list)?list:[];}finally{await releaseSharedDatabase(sql);}
}
export function confirmedMiaLegacyExpiry(source:string,confirmations:MiaSourceValidityConfirmation[]) {
  const identity=miaSourceIdentity(source);if(!identity)return undefined;
  const found=confirmations.find(c=>miaSourceIdentity(c.source)===identity&&/^\d{4}-\d{2}-\d{2}$/.test(c.legacyExpiry)&&Date.parse(c.confirmedAt)<=Date.now()&&Date.parse(c.confirmedAt)>=Date.parse(c.legacyExpiry));
  return found?.legacyExpiry;
}
/** Run only after an explicit, recorded owner confirmation. No prices are stored here. */
export async function recordMiaSourceValidityConfirmation(confirmation:MiaSourceValidityConfirmation) {
  if(!miaSourceIdentity(confirmation.source)||!confirmedMiaLegacyExpiry(confirmation.source,[confirmation])||!confirmation.evidence.trim())throw Error('Confirmación de fuente inválida.');
  const sql=getSharedDatabase();try{await sql.begin(async tx=>{
    await tx`SELECT pg_advisory_xact_lock(74102617)`;
    const [row]=await tx`SELECT value FROM crm_whatsapp_agent_settings WHERE key='mia-source-validity-confirmations-v1' FOR UPDATE`;
    const previous:MiaSourceValidityConfirmation[]=row?JSON.parse(row.value):[];
    const next=[...previous.filter(c=>miaSourceIdentity(c.source)!==miaSourceIdentity(confirmation.source)),confirmation];
    await tx`INSERT INTO crm_whatsapp_agent_settings(key,value) VALUES('mia-source-validity-confirmations-v1',${JSON.stringify(next)}) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`;
    await tx`INSERT INTO crm_whatsapp_agent_settings(key,value) VALUES(${'mia-source-validity-confirmation:'+confirmation.confirmedAt},${JSON.stringify(confirmation)})`;
  });}finally{await releaseSharedDatabase(sql);}
}
