// Explicit setup probe: read Meta assets, then save only an account ID whose
// phone list confirms the existing company line. Never sends customer messages.
const fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript');
const resolve=Module._resolveFilename;Module._resolveFilename=function(id,parent,...rest){return resolve.call(this,id.startsWith('@/')?path.join(process.cwd(),id.slice(2)):id,parent,...rest);};
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
(async()=>{const {getWhatsAppChannelCredentials}=require('../lib/whatsapp-credentials.ts'),{firstContactWhatsAppPhoneId}=require('../lib/whatsapp-inbox-scope.ts'),{miaSalesDb}=require('../lib/mia-sales-store.ts');
 const saved=await getWhatsAppChannelCredentials(),tokens=[...new Set([process.env.META_ACCESS_TOKEN,process.env.WHATSAPP_ACCESS_TOKEN,saved?.accessToken].filter(Boolean))];
 const businesses=['4197061273875373','1865312157520372']; // Owning businesses returned by Meta's connected app list, 22/10/2026.
 const version=process.env.WHATSAPP_GRAPH_VERSION||'v23.0',checks=[];let found;
 outer:for(let i=0;i<tokens.length;i++)for(const business of businesses)for(const edge of ['owned_whatsapp_business_accounts','client_whatsapp_business_accounts']){
  try{const response=await fetch(`https://graph.facebook.com/${version}/${business}/${edge}?fields=id&limit=100`,{headers:{Authorization:'Bearer '+tokens[i]},signal:AbortSignal.timeout(10000)}),data=await response.json();checks.push({credential:i,business,edge,status:response.status,errorCode:data.error?.code||null});
   if(!response.ok)continue;
   for(const account of data.data||[]){const phoneResponse=await fetch(`https://graph.facebook.com/${version}/${account.id}/phone_numbers?fields=id&limit=100`,{headers:{Authorization:'Bearer '+tokens[i]},signal:AbortSignal.timeout(10000)}),phones=await phoneResponse.json();if(phoneResponse.ok&&phones.data?.some(p=>p.id===firstContactWhatsAppPhoneId())){found=account.id;break outer;}}
  }catch{checks.push({credential:i,business,edge,status:'metadata_unavailable'});}
 }
 if(found){const sql=miaSalesDb();try{await sql`INSERT INTO crm_whatsapp_agent_settings(key,value) VALUES('mia-sales-waba-v1',${JSON.stringify({wabaId:found,phoneNumberId:firstContactWhatsAppPhoneId()})}) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`;}finally{await sql.end();}}
 console.log('MIA_WHATSAPP_ACCOUNT_DISCOVERY',JSON.stringify({matchedCompanyLine:Boolean(found),accountId:found||null,checks,customerSends:0}));
})().catch(()=>{console.error('MIA_WHATSAPP_ACCOUNT_DISCOVERY metadata unavailable; no customer sends');process.exitCode=1});
