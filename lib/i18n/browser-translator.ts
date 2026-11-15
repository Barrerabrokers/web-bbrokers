import { SITE_ENGLISH,translationCandidate,translationSegments } from '@/lib/i18n/english';
import { isPublicSitePath,languagePath } from '@/lib/i18n/routing';
type Status={pending:boolean;failed:boolean};
type TextRecord={source:string;last:string};
const excluded='script,style,noscript,textarea,input,code,pre,[contenteditable],[translate="no"],.notranslate,[data-no-translate],[data-private]';
const attributes=['placeholder','aria-label','title','alt'] as const;
/** Change text in place (no wrappers), preserving React's element structure and form values. */
export function startSiteTranslation(document:Document,translate:(texts:string[])=>Promise<{translations:Record<string,string>;missing:string[]}>,status:(value:Status)=>void,initialTranslations:Record<string,string>={}) {
 const cache=new Map([...Object.entries(initialTranslations),...Object.entries(SITE_ENGLISH)]),records=new WeakMap<Text,TextRecord>(),attributeRecords=new WeakMap<Element,Map<string,TextRecord>>();
 const failed=new Set<string>();let stopped=false,running=false,timer:ReturnType<typeof setTimeout>|undefined;
 try{const saved=JSON.parse(sessionStorage.getItem('bb-site-english-v2')||'{}');for(const [key,value] of Object.entries(saved))if(typeof value==='string'&&!Object.prototype.hasOwnProperty.call(SITE_ENGLISH,key))cache.set(key,value);}catch{}
 const observer=new MutationObserver(()=>schedule());
 const observe=()=>observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:[...attributes,'href','content']});
 function schedule(){if(stopped||timer)return;timer=setTimeout(()=>{timer=undefined;void scan();},90);}
 function sourceRecord(current:string,record?:TextRecord):TextRecord {return record&&record.last===current?record:{source:current,last:current};}
 function localLink(element:Element) {
  if(!(element instanceof HTMLAnchorElement)||element.hasAttribute('download'))return;
  try{const url=new URL(element.getAttribute('href')||'',location.href);if(url.origin!==location.origin||!isPublicSitePath(url.pathname))return;const href=languagePath(url.pathname,'en')+url.search+url.hash;if(element.getAttribute('href')!==href)element.setAttribute('href',href);}catch{}
 }
 async function scan(){
  if(stopped)return;
  const pending=new Set<string>();observer.disconnect();
  const apply=(record:TextRecord,write:(text:string)=>void)=>{let complete=true;const parts=translationSegments(record.source).map(part=>{const text=part.trim();if(!translationCandidate(text))return part;const translated=cache.get(text);if(translated!==undefined)return part.replace(text,()=>translated);complete=false;if(!failed.has(text))pending.add(text);return part;});if(complete){const value=parts.join('');if(record.last!==value){write(value);record.last=value;}}};
  try{
   const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node:Node|null;
   while((node=walker.nextNode())){const text=node as Text;if(text.parentElement?.tagName==='OPTION'&&!text.parentElement.hasAttribute('value'))text.parentElement.setAttribute('value',text.parentElement.textContent||'');if(!text.parentElement||text.parentElement.closest(excluded))continue;const record=sourceRecord(text.data,records.get(text));records.set(text,record);apply(record,value=>{text.data=value;});}
   for(const element of Array.from(document.body.querySelectorAll('[placeholder],[aria-label],[title],[alt],a[href]'))){if(element.closest(excluded.replace('textarea,input,','')))continue;localLink(element);let map=attributeRecords.get(element);if(!map){map=new Map();attributeRecords.set(element,map);}for(const attr of attributes){const current=element.getAttribute(attr);if(!current)continue;const record=sourceRecord(current,map.get(attr));map.set(attr,record);apply(record,value=>element.setAttribute(attr,value));}}

  }finally{if(!stopped)observe();}
  if(running)return;
  const batch:string[]=[];let size=0;for(const text of pending){if(batch.length===50||size+text.length>14000)break;batch.push(text);size+=text.length;}
  if(!batch.length){status({pending:false,failed:failed.size>0});return;}
  running=true;status({pending:true,failed:failed.size>0});
  try{const result=await translate(batch);if(stopped)return;for(const [source,english] of Object.entries(result.translations))cache.set(source,english);for(const source of batch)if(!Object.prototype.hasOwnProperty.call(result.translations,source))failed.add(source);try{sessionStorage.setItem('bb-site-english-v2',JSON.stringify(Object.fromEntries([...cache].slice(-1500))));}catch{}}
  catch{for(const source of batch)failed.add(source);}
  finally{running=false;if(!stopped)schedule();}
 }
 observe();schedule();
 return {retry(){failed.clear();schedule();},stop(){stopped=true;observer.disconnect();if(timer)clearTimeout(timer);}};
}
