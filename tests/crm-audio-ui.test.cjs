const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function harness({getUserMedia,fetch}){
 let index=0;const slots=[],cleanups=[];let stopped=0;
 const react={useRef:value=>{const i=index++;return slots[i]||(slots[i]={current:value});},useState:value=>{const i=index++;if(!(i in slots))slots[i]=value;return[slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},useEffect:effect=>{const i=index++;if(!(i in slots)){slots[i]=true;cleanups.push(effect());}}};
 class Recorder{static isTypeSupported(type){return type.includes('webm');}constructor(media){this.mimeType='audio/webm';this.state='inactive';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['voice'])});this.onstop?.();}}
 const audio={CRM_AUDIO_ACCEPT:'audio/*',validateCrmAudio:()=>null};const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/admin/crm-audio-transcriber.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,require:id=>id==='react'?react:id==='@/lib/crm-audio'?audio:id==='lucide-react'?Object.fromEntries(['Loader2','Mic','Square','Upload','X'].map(k=>[k,()=>null])):require(id),navigator:{mediaDevices:{getUserMedia:getUserMedia||(async()=>({getTracks:()=>[{stop:()=>stopped++}]}))}},MediaRecorder:Recorder,fetch,File,Blob,FormData,AbortController,setTimeout,clearTimeout,setInterval,clearInterval});
 const transcripts=[],busy=[];const props={leadId:'lead',onTranscript:text=>transcripts.push(text),onBusyChange:value=>busy.push(value)};
 const render=()=>{index=0;return module.exports.CrmAudioTranscriber(props);};
 function nodes(tree){return !tree||typeof tree!=='object'?[]:[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];}
 function text(tree){return tree==null?'':typeof tree==='string'||typeof tree==='number'?String(tree):[tree.props?.children].flat(Infinity).map(text).join('');}
 return {transcripts,busy,render,stopped:()=>stopped,close:()=>cleanups.forEach(fn=>fn?.()),button:label=>nodes(render()).find(n=>n.type==='button'&&text(n).startsWith(label)),input:()=>nodes(render()).find(n=>n.type==='input')};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('recording stops microphone and appends transcription, then unlocks saving',async()=>{
 const h=harness({fetch:async()=>Response.json({text:'Quiere coordinar una visita.'})});
 await h.button('Grabar audio').props.onClick();await tick();
 assert.ok(h.button('Detener y transcribir'));h.button('Detener y transcribir').props.onClick();await tick();await tick();
 assert.deepEqual(h.transcripts,['Quiere coordinar una visita.']);assert.equal(h.stopped(),1);assert.equal(h.busy.at(-1),false);h.close();
});
test('closing while microphone permission is pending releases late stream without recording',async()=>{
 let resolve,stops=0;const h=harness({getUserMedia:()=>new Promise(r=>resolve=r),fetch:async()=>{throw Error('must not call');}});
 h.button('Grabar audio').props.onClick();h.close();resolve({getTracks:()=>[{stop:()=>stops++}]});await tick();
 assert.equal(stops,1);assert.equal(h.transcripts.length,0);
});
test('cancelled transcription cannot append a late response to current text',async()=>{
 let resolve;const h=harness({fetch:()=>new Promise(r=>resolve=r)});
 h.input().props.onChange({target:{files:[new File(['voice'],'nota.m4a')],value:'nota.m4a'}});
 h.button('Cancelar audio').props.onClick();resolve(Response.json({text:'Late response'}));await tick();await tick();
 assert.equal(h.transcripts.length,0);assert.equal(h.busy.at(-1),false);h.close();
});
test('failed upload can be retried without losing its audio',async()=>{
 let calls=0;const h=harness({fetch:async()=>{calls++;return calls===1?Response.json({error:'Ocupado'},{status:429}):Response.json({text:'Texto recuperado'});}});
 h.input().props.onChange({target:{files:[new File(['voice'],'nota.m4a')],value:'nota.m4a'}});await tick();await tick();
 h.button('Reintentar transcripción').props.onClick();await tick();await tick();assert.deepEqual(h.transcripts,['Texto recuperado']);h.close();
});
