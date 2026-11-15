import { randomUUID } from 'crypto';
import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
import type { AgentMemory } from '@/lib/mia-agent-search';
let ready:Promise<void>|undefined;
export async function ensureMiaLearnings(){
 if(!ready)ready=(async()=>{const sql=getSharedDatabase();try{
 await sql`CREATE TABLE IF NOT EXISTS mia_learnings(id UUID PRIMARY KEY,lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL,conversation_id UUID REFERENCES crm_whatsapp_conversations(id) ON DELETE CASCADE,inbound_id TEXT,fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),perfil TEXT NOT NULL DEFAULT 'sin_definir',boton_caliente TEXT,resumen_conversacion TEXT NOT NULL DEFAULT '',que_funciono TEXT NOT NULL DEFAULT 'Sin evaluación confirmada',que_fallo TEXT NOT NULL DEFAULT 'Sin evaluación confirmada',correccion_recibida TEXT NOT NULL DEFAULT '',regla_nueva TEXT NOT NULL DEFAULT '',aplicar_en_futuro BOOLEAN NOT NULL DEFAULT FALSE,approved_by UUID REFERENCES agents(id),source_key TEXT UNIQUE NOT NULL,reply TEXT NOT NULL DEFAULT '',tipo_pregunta TEXT NOT NULL DEFAULT 'otra',reglas_aplicadas JSONB NOT NULL DEFAULT '[]')`;
 await sql`ALTER TABLE mia_learnings ADD COLUMN IF NOT EXISTS document JSONB`;
 await sql`ALTER TABLE mia_learnings ENABLE ROW LEVEL SECURITY`;
 await sql`CREATE INDEX IF NOT EXISTS mia_learnings_rules ON mia_learnings(fecha DESC) WHERE aplicar_en_futuro=TRUE`;
 await sql`CREATE INDEX IF NOT EXISTS mia_learnings_profile ON mia_learnings(perfil,fecha DESC)`;
 const [legacy]=await sql`SELECT value FROM crm_whatsapp_agent_settings WHERE key='mia-guidance-v1'`;
 if(legacy){const guidance=JSON.parse(legacy.value);for(const correction of guidance.corrections||[]){
  const [admin]=await sql`SELECT id FROM agents WHERE id=${correction.actorId} AND role='admin' AND active=TRUE`;
  if(admin)await sql`INSERT INTO mia_learnings(id,source_key,fecha,correccion_recibida,regla_nueva,aplicar_en_futuro,approved_by) VALUES(${randomUUID()},${'legacy-correction:'+correction.id},${correction.createdAt}::timestamptz,${String(correction.incorrect||'')+' → '+String(correction.corrected||'')},${String(correction.instruction||correction.corrected||'')},TRUE,${admin.id}) ON CONFLICT(source_key) DO NOTHING`;
 }}
 }finally{await releaseSharedDatabase(sql);}})().catch(e=>{ready=undefined;throw e;});await ready;
}
export function miaLearningProfile(memory:AgentMemory){return memory.deferredContact?.active&&memory.preferences.purpose==='living'?'mudanza_futura':memory.preferences.purpose==='living'?'vivienda':memory.preferences.purpose?'inversion_renta':'sin_definir';}
export function miaQuestionKind(reply:string){return /presupuesto|rango|número.*cómodo/i.test(reply)?'presupuesto':/fecha|plazo|entrega/i.test(reply)?'entrega':/llamada|reunión|visita/i.test(reply)?'cita':/barrio|zona/i.test(reply)?'ubicacion':/vivir|invertir/i.test(reply)?'destino':'otra';}
/** No customer text or personal facts are shared as profile examples. */
export async function readMiaLearnings(profile:string){
 await ensureMiaLearnings();const sql=getSharedDatabase();try{
 const rules=await sql`SELECT id,regla_nueva FROM mia_learnings WHERE aplicar_en_futuro=TRUE AND approved_by IS NOT NULL ORDER BY fecha ASC,id ASC`;
 const examples=await sql`SELECT perfil,boton_caliente,tipo_pregunta FROM (SELECT DISTINCT ON(conversation_id) conversation_id,perfil,boton_caliente,tipo_pregunta,fecha FROM mia_learnings WHERE perfil=${profile} AND conversation_id IS NOT NULL AND reply<>'' ORDER BY conversation_id,fecha DESC) recent ORDER BY fecha DESC LIMIT 3`;
 return {rules:rules.map(r=>({id:String(r.id),rule:String(r.regla_nueva)})),examples:examples.map(e=>({profile:e.perfil,focus:e.boton_caliente,question:e.tipo_pregunta}))};
 }finally{await releaseSharedDatabase(sql);}
}
export async function appendMiaLearningCorrection(tx:any,actorId:string,key:string,correction:string,rule:string){
 const [admin]=await tx`SELECT id FROM agents WHERE id=${actorId} AND role='admin' AND active=TRUE`;if(!admin)throw Error('Solo administradores activos pueden aprobar reglas.');
 const document={id:key,fecha:new Date().toISOString(),tipo:'correccion',origen:'Administración CRM',caso_ejemplo:correction,que_fallo:correction,correccion_recibida:correction,regla_nueva:rule,aplicar_en_futuro:true,prioridad:'alta',aplica_a:'leads_asignados_a_MIA_y_whatsapp_inbound',test_validacion:'Revisar en simulador antes de publicar cambios de comportamiento.'};
 await tx`INSERT INTO mia_learnings(id,source_key,correccion_recibida,regla_nueva,aplicar_en_futuro,approved_by,document) VALUES(${randomUUID()},${key},${correction},${rule},TRUE,${actorId},${JSON.stringify(document)}::jsonb) ON CONFLICT(source_key) DO NOTHING`;
}
export async function recordMiaLearningTurn(conversationId:string,inboundId:string,memory:AgentMemory,reply:string,ruleIds:string[]){
 await ensureMiaLearnings();const sql=getSharedDatabase();try{
 await sql.begin(async tx=>{
 const [current]=await tx`SELECT c.lead_id,m.id,m.content,m.created_at FROM crm_whatsapp_conversations c JOIN crm_whatsapp_messages m ON m.conversation_id=c.id WHERE c.id=${conversationId} AND c.ai_enabled=TRUE AND m.status NOT IN('cleared','historical') ORDER BY m.created_at DESC,m.id DESC LIMIT 1`;
 if(current?.id!==inboundId)return;
 await tx`UPDATE mia_learnings l SET que_funciono='El cliente volvió a responder después del mensaje; no prueba causalidad ni venta.' WHERE l.conversation_id=${conversationId} AND l.id=(SELECT previous.id FROM mia_learnings previous WHERE previous.conversation_id=${conversationId} AND previous.fecha<${current.created_at}::timestamptz AND EXISTS(SELECT 1 FROM crm_whatsapp_messages sent WHERE sent.conversation_id=previous.conversation_id AND sent.sender_type='ai' AND sent.direction='outbound' AND sent.content=previous.reply AND sent.created_at>=previous.fecha AND sent.created_at<${current.created_at}::timestamptz AND sent.status NOT IN('failed','error','historical','cleared')) ORDER BY previous.fecha DESC LIMIT 1)`;
 const profile=miaLearningProfile(memory),focus=memory.salesNeeds?.focus||null;
 const objection=/caro|precio|presupuesto/i.test(current.content)?'precio':/no conozco|nuevo/i.test(current.content)?'novedad':/desconf|miedo|dudas/i.test(current.content)?'desconfianza':null;
 const summary=JSON.stringify({objection,profile,focus,purpose:memory.preferences.purpose,hasBudget:!!memory.preferences.total,deferred:!!memory.deferredContact?.active,advance:memory.salesNeeds?.advance||null});
 await tx`INSERT INTO mia_learnings(id,lead_id,conversation_id,inbound_id,perfil,boton_caliente,resumen_conversacion,source_key,reply,tipo_pregunta,reglas_aplicadas) VALUES(${randomUUID()},${current.lead_id},${conversationId},${inboundId},${profile},${focus},${summary},${'turn:'+conversationId+':'+inboundId},${reply},${miaQuestionKind(reply)},${JSON.stringify(ruleIds)}::jsonb) ON CONFLICT(source_key) DO NOTHING`;
 });}finally{await releaseSharedDatabase(sql);}
}
export async function miaWeeklyLearningReport(){
 await ensureMiaLearnings();const sql=getSharedDatabase();try{
 const rows=await sql`SELECT l.perfil,l.tipo_pregunta,COUNT(*)::int AS generadas,COUNT(sent.id)::int AS enviadas,COUNT(answer.id)::int AS respondidas FROM mia_learnings l
 LEFT JOIN LATERAL(SELECT m.id,m.created_at FROM crm_whatsapp_messages m WHERE m.conversation_id=l.conversation_id AND m.direction='outbound' AND m.sender_type='ai' AND m.content=l.reply AND m.created_at>=l.fecha AND m.status NOT IN('failed','error','historical','cleared') ORDER BY m.created_at LIMIT 1) sent ON TRUE
 LEFT JOIN LATERAL(SELECT m.id FROM crm_whatsapp_messages m WHERE m.conversation_id=l.conversation_id AND m.direction='inbound' AND m.created_at>sent.created_at AND m.status NOT IN('historical','cleared') AND m.created_at<sent.created_at+INTERVAL '7 days' ORDER BY m.created_at LIMIT 1) answer ON TRUE
 WHERE l.fecha>=NOW()-INTERVAL '7 days' AND l.conversation_id IS NOT NULL GROUP BY l.perfil,l.tipo_pregunta ORDER BY respondidas DESC,enviadas DESC`;
 const corrections=await sql`SELECT id,fecha,correccion_recibida,regla_nueva,aplicar_en_futuro FROM mia_learnings WHERE approved_by IS NOT NULL ORDER BY fecha DESC LIMIT 10`;
 const objections=await sql`SELECT resumen_conversacion::jsonb->>'objection' AS tipo,COUNT(*)::int AS cantidad FROM mia_learnings WHERE conversation_id IS NOT NULL AND fecha>=NOW()-INTERVAL '7 days' AND resumen_conversacion::jsonb->>'objection' IS NOT NULL GROUP BY 1 ORDER BY cantidad DESC`;
 return {periodDays:7,rows,corrections,objections,note:'Respuestas posteriores observadas, no prueba de causalidad ni de venta. Las reglas nuevas requieren aprobación administrativa.'};
 }finally{await releaseSharedDatabase(sql);}
}

/** Durable JSON export: Vercel deployments have immutable local source files. */
export async function exportMiaLearningDocuments(){
 await ensureMiaLearnings();const sql=getSharedDatabase();try{
 const rows=await sql`SELECT source_key,fecha,que_fallo,correccion_recibida,regla_nueva,aplicar_en_futuro,document FROM mia_learnings WHERE approved_by IS NOT NULL ORDER BY fecha,source_key`;
 return rows.map(r=>({...{id:r.source_key,fecha:r.fecha,tipo:'correccion',origen:'Administración CRM',caso_ejemplo:r.correccion_recibida,que_fallo:r.que_fallo,correccion_recibida:r.correccion_recibida,regla_nueva:r.regla_nueva,prioridad:'alta',aplica_a:'leads_asignados_a_MIA_y_whatsapp_inbound',test_validacion:'Validar conversación completa'},...(r.document||{}),aplicar_en_futuro:r.aplicar_en_futuro}));
 }finally{await releaseSharedDatabase(sql);}
}
