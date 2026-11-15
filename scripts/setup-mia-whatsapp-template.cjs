// One-time setup authorized by the five-contact reactivation pilot. Submits a
// MARKETING template for Meta review; does not send it to any customer.
const fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript');
const resolve=Module._resolveFilename;Module._resolveFilename=function(id,parent,...rest){return resolve.call(this,id.startsWith('@/')?path.join(process.cwd(),id.slice(2)):id,parent,...rest);};
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
(async()=>{const {getWhatsAppChannelCredentials}=require('../lib/whatsapp-credentials.ts'),{firstContactWhatsAppPhoneId}=require('../lib/whatsapp-inbox-scope.ts'),{miaSalesDb}=require('../lib/mia-sales-store.ts');
 const sql=miaSalesDb();try{const [row]=await sql`SELECT value FROM crm_whatsapp_agent_settings WHERE key='mia-sales-waba-v1'`;const matched=row&&JSON.parse(row.value);if(!matched?.wabaId||matched.phoneNumberId!==firstContactWhatsAppPhoneId())throw Error('Company WhatsApp account has not been verified.');
 const saved=await getWhatsAppChannelCredentials(),tokens=[...new Set([process.env.WHATSAPP_ACCESS_TOKEN,saved?.accessToken,process.env.META_ACCESS_TOKEN].filter(Boolean))];
 const version=process.env.WHATSAPP_GRAPH_VERSION||'v23.0',name='bb_mia_reactivacion_20261022';
 let result,failures=[];
 for(const token of tokens){
  const url=`https://graph.facebook.com/${version}/${matched.wabaId}/message_templates`;
  const listed=await fetch(url+`?name=${name}&fields=name,status,language,id&limit=100`,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)}),data=await listed.json();
  if(!listed.ok){failures.push({action:'read',status:listed.status,code:data.error?.code});continue;}
  result=data.data?.find(t=>t.name===name);
  if(!result){const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({name,language:'es_AR',category:'MARKETING',components:[{type:'BODY',text:'Hola {{1}}, soy MIA, la asistente virtual de Barrera Brokers. Retomo tu consulta sobre {{2}}. ¿Seguís buscando una propiedad? Si preferís no recibir más mensajes, avisame y lo dejamos acá.',example:{body_text:[['Mariana','un departamento']]}}]}),signal:AbortSignal.timeout(15000)}),created=await response.json();if(!response.ok){failures.push({action:'submit',status:response.status,code:created.error?.code});continue;}result={name,language:'es_AR',id:created.id,status:created.status||'PENDING'};}
  if(result)break;
 }
 if(result){await sql`INSERT INTO crm_whatsapp_agent_settings(key,value) VALUES('mia-sales-template-v1',${JSON.stringify({name,language:result.language||'es_AR',id:result.id})}) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`;console.log('MIA_WHATSAPP_TEMPLATE_SETUP',JSON.stringify({name,status:result.status,accountMatchesCompany:true,customerSends:0}));}
 else console.log('MIA_WHATSAPP_TEMPLATE_SETUP',JSON.stringify({submitted:false,failures,customerSends:0}));
 }finally{await sql.end();}
})().catch(e=>{console.error('MIA_WHATSAPP_TEMPLATE_SETUP',e.message);process.exitCode=1});
