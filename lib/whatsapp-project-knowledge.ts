import postgres from 'postgres';
let ready:Promise<void>|undefined;
function db(){const url=process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.POSTGRES_URL_NON_POOLING||process.env.DATABASE_URL||process.env.SUPABASE_DB_URL;if(!url)throw new Error('Missing knowledge database');return postgres(url,{ssl:'require',max:1,prepare:false,connect_timeout:8});}
export async function ensureProjectKnowledge(){if(!ready)ready=(async()=>{const sql=db();try{await sql`CREATE TABLE IF NOT EXISTS crm_ai_project_knowledge (development_id UUID PRIMARY KEY REFERENCES developments(id) ON DELETE CASCADE, facts JSONB NOT NULL, approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;await sql`ALTER TABLE crm_ai_project_knowledge ENABLE ROW LEVEL SECURITY`;}finally{await sql.end()}})().catch(e=>{ready=undefined;throw e});await ready;}
export async function loadProjectKnowledge(developmentId:string){await ensureProjectKnowledge();const sql=db();try{const [row]=await sql`SELECT facts,approved_at FROM crm_ai_project_knowledge WHERE development_id=${developmentId}`;return row?{...row.facts,approvedAt:row.approved_at}:undefined;}finally{await sql.end()}}
export function selectReferenceUnits(units:any[],query:string) {
  const text=query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const rooms=/monoambiente/.test(text)?1:text.match(/\b([23])\s*ambientes?/)?.[1];
  const unit=text.match(/\b(?:unidad|uf|depto)\s*(\d{3,4})\b/)?.[1];
  const floor=text.match(/\bpiso\s*(\d{1,2})\b/)?.[1];
  const high=/pisos?\s+altos?|no me gustan? (?:los )?pisos? bajos?/.test(text);
  const candidates=units.filter(u=>u.sourceStatus==='LIBRE' && (!rooms || u.rooms===Number(rooms)) && (!unit || String(u.unit)===unit) && (!floor || (/superior|arriba|desde|minimo/.test(text) ? u.floor>=Number(floor) : u.floor===Number(floor))));
  const topFloor=Math.max(0,...candidates.map(u=>Number(u.floor)||0));
  return candidates.filter(u=>!high || Number(u.floor)>=Math.max(2,Math.ceil(topFloor/2))).sort((a,b)=>high ? Number(b.floor)-Number(a.floor)||a.price-b.price : a.price-b.price).slice(0,5);
}
