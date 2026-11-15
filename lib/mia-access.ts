import { getSharedDatabase, releaseSharedDatabase } from '@/lib/database-pool';
export type MiaAccess={mode:'all'|'pilot'|'disabled';conversationIds:string[];manualPause?:boolean};
export function parseMiaAccess(value:unknown):MiaAccess {
  if(value===undefined)return {mode:'all',conversationIds:[]};
  try{const data=typeof value==='string'?JSON.parse(value):value;
    if(!data||!['all','pilot','disabled'].includes(data.mode))return {mode:'disabled',conversationIds:[]};
    return {mode:data.mode,manualPause:data.pausePolicy==='manual',conversationIds:Array.isArray(data.conversationIds)?data.conversationIds.filter((id:unknown)=>typeof id==='string'):[]};
  }catch{return {mode:'disabled',conversationIds:[]};}
}
export const miaAccessAllows=(access:MiaAccess,id:string)=>access.mode==='all'||access.mode==='pilot'&&access.conversationIds.includes(id);
export async function getMiaAccess(tx?:any):Promise<MiaAccess> {
  const sql=tx||getSharedDatabase();try{const [row]=await sql`SELECT value FROM crm_whatsapp_agent_settings WHERE key='mia-access-v1'`;return parseMiaAccess(row?.value);}catch{return {mode:'disabled',conversationIds:[]};}finally{if(!tx)await releaseSharedDatabase(sql);}
}

/** The production rollout keeps the same conversational assistant used in the pilot. */
export const miaConsultativeEnabled=(access:MiaAccess)=>access.mode==='all'||access.mode==='pilot';
