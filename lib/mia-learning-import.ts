import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getSharedDatabase,releaseSharedDatabase } from '@/lib/database-pool';
import { ensureMiaLearnings } from '@/lib/mia-learnings';
export const miaLearningDocumentSchema=z.object({id:z.string().min(1).max(160),fecha:z.string().refine(v=>Number.isFinite(Date.parse(v))),tipo:z.enum(['correccion','aprendizaje']),origen:z.string().max(500),caso_ejemplo:z.string().max(6000),que_fallo:z.string().max(6000),correccion_recibida:z.string().max(6000),regla_nueva:z.string().min(1).max(6000),aplicar_en_futuro:z.boolean(),prioridad:z.string().max(50),aplica_a:z.string().max(200),test_validacion:z.string().max(6000)}).passthrough();
export async function importMiaLearningDocuments(input:unknown,actorId:string){
 const documents=z.array(miaLearningDocumentSchema).min(1).max(100).parse(input);
 if(new Set(documents.map(d=>d.id)).size!==documents.length)throw Error('Identificadores repetidos');
 await ensureMiaLearnings();const sql=getSharedDatabase();try{return await sql.begin(async tx=>{
 const [admin]=await tx`SELECT id FROM agents WHERE id=${actorId} AND role='admin' AND active=TRUE`;if(!admin)throw Error('Solo administradores');
 for(const d of documents)await tx`INSERT INTO mia_learnings(id,source_key,fecha,que_fallo,correccion_recibida,regla_nueva,aplicar_en_futuro,approved_by,document) VALUES(${randomUUID()},${d.id},${d.fecha}::timestamptz,${d.que_fallo},${d.correccion_recibida},${d.regla_nueva},${d.aplicar_en_futuro},${actorId},${JSON.stringify(d)}::jsonb) ON CONFLICT(source_key) DO UPDATE SET document=EXCLUDED.document,que_fallo=EXCLUDED.que_fallo,correccion_recibida=EXCLUDED.correccion_recibida,regla_nueva=EXCLUDED.regla_nueva,aplicar_en_futuro=EXCLUDED.aplicar_en_futuro,approved_by=EXCLUDED.approved_by`;
 // The uploaded correction supersedes the earlier same-topic entry, which remains in history.
 if(documents.some(d=>d.id==='mia_learnings_003_anti_loop_reunion'))await tx`UPDATE mia_learnings SET aplicar_en_futuro=FALSE WHERE source_key='mia_learnings_001_anti_loop_reunion'`;
 return {imported:documents.length,ids:documents.map(d=>d.id)};
 });}finally{await releaseSharedDatabase(sql);}
}
