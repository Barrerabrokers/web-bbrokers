const CURRENT_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
const REPLACEMENTS: Record<string,string> = {
  'llama-3.3-70b-versatile': 'openai/gpt-oss-120b',
  'llama-3.1-8b-instant': 'openai/gpt-oss-20b',
  'qwen/qwen3.6-27b': 'qwen/qwen3.8-27b',
};
let activeModels: { ids: Set<string>; expires: number } | undefined;
async function customerReplyModels(consultative=false,jsonObject=false) {
  const configured = [process.env.GROQ_WHATSAPP_MODEL || process.env.GROQ_CRM_MODEL || CURRENT_MODELS[0], ...(process.env.GROQ_WHATSAPP_FALLBACK_MODELS || '').split(',').map(m=>m.trim()).filter(Boolean), ...CURRENT_MODELS];
  const candidates = [...new Set(configured.map(m=>REPLACEMENTS[m] || m))];
  if (!activeModels || activeModels.expires < Date.now()) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {headers:{Authorization:`Bearer ${process.env.GROQ_API_KEY}`},signal:AbortSignal.timeout(5000)});
      if (response.status===401) throw new Error('AI_PROVIDER_UNAVAILABLE:invalid_api_key');
      const result = await response.json().catch(()=>null);
      if (response.ok && Array.isArray(result?.data) && result.data.length) {
        activeModels = {ids:new Set(result.data.filter((m:{id?:unknown;active?:boolean})=>typeof m.id==='string' && m.active!==false).map((m:{id:string})=>m.id)),expires:Date.now()+10*60*1000};
      }
    } catch(error) { if(error instanceof Error && error.message.includes('invalid_api_key'))throw error; }
  }
  const ordered=consultative&&!jsonObject?[candidates[0],...candidates.slice(1).sort((a,b)=>Number(a==='openai/gpt-oss-20b')-Number(b==='openai/gpt-oss-20b'))]:candidates;
  const models=(activeModels ? ordered.filter(m=>activeModels!.ids.has(m)) : ordered).slice(0,3);
  if(!models.length) throw new Error('AI_PROVIDER_UNAVAILABLE:no_supported_chat_model');
  return models;
}
export async function generateGroqCustomerReply(instructions: string, input: {role:string;content:string}[], budgetInstructions?:string, options?:{timeoutMs:number;reasoningEffort?:'low'|'medium';jsonObject?:boolean}) {
  const deadline=options?Date.now()+options.timeoutMs:undefined;
  const models = await customerReplyModels(options?.reasoningEffort==='medium',options?.jsonObject);
  let lastCode = 'unavailable';
  for (const model of models) {
   // Retry a provider JSON-mode rejection once as plain text. The JSON object and
   // the caller's schema/evidence validation remain mandatory.
   for(let formatAttempt=0;formatAttempt<(options?.jsonObject?2:1);formatAttempt++){
    const remaining=deadline?deadline-Date.now():20000;
    if(remaining<=0)break;
    const useBudget=!!budgetInstructions && model!=='openai/gpt-oss-120b';
    const requestInstructions=(useBudget ? budgetInstructions! : instructions)+(formatAttempt?'\nRespondé únicamente un objeto JSON válido. Sin Markdown, comentarios ni texto fuera del objeto. Conservá exactamente el esquema solicitado.':'');
    const requestInput=useBudget ? input.slice(-3).map(m=>({...m,content:m.content.slice(0,800)})) : input;
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {method:'POST',headers:{Authorization:`Bearer ${process.env.GROQ_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model,temperature:0.3,max_completion_tokens:options?.reasoningEffort==='medium'?1600:useBudget?700:1000,...(options?.jsonObject&&formatAttempt===0?{response_format:{type:'json_object'}}:{}),...(model.startsWith('openai/gpt-oss-') ? {reasoning_effort:options?.reasoningEffort||'low',include_reasoning:false} : options?.jsonObject&&model.startsWith('qwen/')?{reasoning_format:'hidden'}:{}),messages:[{role:'system',content:requestInstructions},...requestInput]}),signal:AbortSignal.timeout(Math.min(20000,remaining))});
      const result = await response.json().catch(()=>null);
      if (response.ok && result?.choices?.[0]?.finish_reason!=='length' && result?.choices?.[0]?.message?.content?.trim()) {
        if(options?.jsonObject){try{const parsed=JSON.parse(result.choices[0].message.content);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Not an object');}catch{lastCode='json_validate_failed';if(formatAttempt===0)continue;break;}}
        console.info('whatsapp-ai-provider-success',{model,promptTokens:result.usage?.prompt_tokens,completionTokens:result.usage?.completion_tokens});
        return String(result.choices[0].message.content).trim();
      }
      lastCode = String(result?.error?.code || (response.ok ? result?.choices?.[0]?.finish_reason==='length'?'truncated_reply':'empty_reply' : response.status));
      const errorText=String(result?.error?.message || '');
      const limitKind = /tokens per day|\bTPD\b|daily/i.test(errorText) ? 'daily' : /tokens per minute|\bTPM\b/i.test(errorText) ? 'per_minute' : undefined;
      console.warn('whatsapp-ai-provider', {model,status:response.status,code:lastCode,limitKind});
      if(options?.jsonObject&&lastCode==='json_validate_failed'&&formatAttempt===0)continue;
      if (!response.ok && ![429,404,403,413,500,502,503,504].includes(response.status) && !(options?.jsonObject&&result?.error?.code==='json_validate_failed')) throw new Error('AI_PROVIDER_FATAL:'+lastCode);
      break;
    } catch(error) {if(error instanceof Error&&error.message.startsWith('AI_PROVIDER_FATAL:'))throw new Error('AI_PROVIDER_UNAVAILABLE:'+lastCode);lastCode='timeout';console.warn('whatsapp-ai-provider',{model,code:lastCode});break;}
   }
  }
  throw new Error(`AI_PROVIDER_UNAVAILABLE:${lastCode}`);
}
