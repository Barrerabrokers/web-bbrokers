const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
function load(file,mocks){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>mocks[n]||(n==='@/lib/mia-reply-messages'?require('./load-mia-reply-messages.cjs'):require(n)),Date,URL,console});return module.exports;}
test('WhatsApp phone echoes keep outbound identity, chronology and reject other numbers',async()=>{
 const saved=[],activities=[],seen=new Set();
 const api=load('lib/whatsapp-app-echo.ts',{'@/lib/whatsapp-inbox-scope':{firstContactWhatsAppPhoneId:()=> 'official'},'@/lib/db':{createCrmActivity:async x=>activities.push(x)},'@/lib/whatsapp-inbox':{ensureWhatsAppContact:async()=>({id:'chat',leadId:'lead'}),saveWhatsAppMessage:async x=>{saved.push(x);if(seen.has(x.whatsappMessageId))return false;seen.add(x.whatsappMessageId);return true;}}});
 const value={metadata:{phone_number_id:'official'},message_echoes:[{id:'wamid.phone',to:'5491112345678',timestamp:Math.floor(Date.now()/1000)-50,type:'text',text:{body:'Te confirmo la visita para mañana.'}}]};
 assert.equal(api.whatsAppAppEchoes(value,'other').length,0);
 await api.processWhatsAppAppEchoes(value);await api.processWhatsAppAppEchoes(value);
 assert.equal(saved[0].direction,'outbound');assert.equal(saved[0].senderType,'agent');assert.equal(saved[0].content,value.message_echoes[0].text.body);assert.equal(Date.parse(saved[0].createdAt),value.message_echoes[0].timestamp*1000);assert.equal(activities.length,1);
 assert.equal(api.whatsAppAppEchoes({...value,message_echoes:[{...value.message_echoes[0],timestamp:'invalid'}]},'official').length,0);
});
test('Instagram app replies target the customer, deduplicate and never trigger AI',async()=>{
 const saved=[],contacts=[],activities=[];let generations=0;
 const api=load('lib/meta-message-webhook.ts',{'@/lib/whatsapp-turn-lock':{},'@/lib/whatsapp-mia-conversation':{},'@/lib/db':{createCrmActivity:async x=>activities.push(x)},'@/lib/whatsapp-inbox':{ensureSocialContact:async(c,id)=>{contacts.push(id);return {id:'chat',leadId:'lead',aiEnabled:true};},saveWhatsAppMessage:async x=>{saved.push(x);return true;},generateWhatsAppAiReply:async()=>{generations++;},listWhatsAppMessages:async()=>[],shouldEscalateConversation:()=>false}});
 await api.processMetaMessages({object:'instagram',entry:[{messaging:[{sender:{id:'business'},recipient:{id:'customer'},timestamp:Date.now(),message:{mid:'ig.echo',is_echo:true,text:'Aquí tenés la información.'}}]}]});
 assert.deepEqual(contacts,['customer']);assert.equal(saved[0].direction,'outbound');assert.equal(saved[0].senderType,'agent');assert.equal(generations,0);assert.equal(activities[0].externalSource,'instagram_outbound');
});
