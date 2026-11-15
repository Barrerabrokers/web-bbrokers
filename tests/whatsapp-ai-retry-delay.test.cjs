const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('node:vm'),ts=require('typescript');
function harness({newer=false,old=false}={}){
 const events=[],states=[],job={message_id:'in',conversation_id:'chat'},last={id:'row',whatsappMessageId:'in',direction:'inbound',content:'Consulta',createdAt:new Date().toISOString()};let reads=0;
 const sql=async(strings,...values)=>{const q=strings.join('?');if(q.includes("SET state='processing'"))return [job];if(q.includes('SET state='))states.push(values);return [];};sql.unsafe=async()=>[];
 const mocks={
 '@/lib/database-pool':{getSharedDatabase:()=>sql,releaseSharedDatabase:async()=>{}},
 '@/lib/mia-reset-runtime':{finishMiaPublicHandoff:async()=>{}},
 '@/lib/mia-reply-messages':{splitMiaReplyMessages:s=>[s]},
 '@/lib/mia-access':{getMiaAccess:async()=>({manualPause:true})},
 '@/lib/whatsapp-mia-conversation':{canMiaContinue:()=>true},
 '@/lib/whatsapp-inbox-scope':{firstContactWhatsAppPhoneId:()=> 'business'},
 '@/lib/whatsapp-reply-delay':{waitForWhatsAppReplyDelay:async()=>events.push('wait')},
 '@/lib/whatsapp-turn-lock':{claimWhatsAppAiSend:async()=>{events.push('claim');return 'lock'},releaseWhatsAppSend:async()=>{}},
 '@/lib/whatsapp-inbox':{getWhatsAppConversation:async()=>({id:'chat',aiEnabled:true,channel:'whatsapp',businessPhoneNumberId:'business',status:'open',phone:'phone'}),listWhatsAppMessages:async()=>{reads++;return [(newer&&reads>1)||old?{...last,id:'new',whatsappMessageId:'new'}:last]},generateWhatsAppAiReply:async()=>{events.push('generate');return 'Respuesta'},sendWhatsAppText:async()=>{events.push('send');return 'out'},saveWhatsAppMessage:async()=>events.push('save')}
 };const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/whatsapp-ai-retry.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>mocks[n],Date,console,Promise});return {events,states,run:module.exports.processWhatsAppAiRetries};
}
test('retry waits before generating and only then claims and sends',async()=>{const h=harness();const r=await h.run();assert.equal(r.sent,1);assert.deepEqual(h.events,['wait','generate','claim','send','save']);});
test('new inbound while waiting cancels the obsolete retry without calling the model',async()=>{const h=harness({newer:true});const r=await h.run();assert.equal(r.sent,0);assert.deepEqual(h.events,['wait']);assert.equal(r.skipped,1);});
test('already obsolete jobs do not wait, generate or send',async()=>{const h=harness({old:true});const r=await h.run();assert.equal(r.skipped,1);assert.deepEqual(h.events,[]);});
