'use client';
import { createContext,useContext,useEffect,useState,useRef } from 'react';
import { usePathname } from 'next/navigation';
import { isPublicSitePath,languagePath,publicLanguage,type SiteLanguage } from '@/lib/i18n/routing';
const LanguageContext=createContext<SiteLanguage>('es');
export function SiteLanguageProvider({children,initialLanguage='es',initialTranslations}:{children:React.ReactNode;initialLanguage?:SiteLanguage;initialTranslations?:Record<string,string>}) {
 const pathname=usePathname()||'/';const language=isPublicSitePath(pathname)?initialLanguage==='en'?'en':publicLanguage(pathname):'es';
 const [status,setStatus]=useState({pending:false,failed:false});const retry=useRef<(()=>void)|null>(null);
 useEffect(()=>{
  if(language!=='en'||!isPublicSitePath(pathname)){document.documentElement.lang='es';setStatus({pending:false,failed:false});return;}
  document.documentElement.lang='en';const abort=new AbortController();let stopped=false;let runtime:{stop:()=>void;retry:()=>void}|undefined;
  void import('@/lib/i18n/browser-translator').then(({startSiteTranslation})=>{if(stopped)return;runtime=startSiteTranslation(document,async texts=>{const response=await fetch('/api/public/translations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texts}),signal:abort.signal});if(!response.ok)throw Error('Translation unavailable');return response.json();},setStatus,initialTranslations);retry.current=()=>runtime?.retry();});
  // Next/Link keeps its original React href. Handle English links before React's click handler.
  const navigate=(event:MouseEvent)=>{if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const anchor=(event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement|null;if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download')||anchor.closest('[data-no-translate]'))return;const url=new URL(anchor.href,location.href);if(url.origin!==location.origin||!isPublicSitePath(url.pathname))return;const destination=languagePath(url.pathname,'en')+url.search+url.hash;if(destination===location.pathname+location.search+url.hash&&url.hash)return;event.preventDefault();event.stopPropagation();window.location.assign(destination);};
  document.addEventListener('click',navigate,true);
  return ()=>{stopped=true;abort.abort();runtime?.stop();retry.current=null;document.removeEventListener('click',navigate,true);};
 },[language,pathname,initialTranslations]);
 return <LanguageContext.Provider value={language}>{children}{language==='en'&&(status.pending||status.failed)&&<div data-no-translate className="fixed bottom-4 left-4 z-[80] max-w-[calc(100vw-6rem)] rounded-lg border border-white/20 bg-[#111] px-3 py-2 text-xs text-white" role="status" aria-live="polite">{status.pending?'Translating this page…':<>Some English text could not be loaded. <button type="button" className="ml-1 underline underline-offset-4" onClick={()=>retry.current?.()}>Retry</button></>}</div>}</LanguageContext.Provider>;
}
export function LanguageSwitcher() {
 const language=useContext(LanguageContext);
 return <label data-no-translate className="relative inline-flex h-10 shrink-0 items-center rounded-full border border-white/25 bg-black/40 text-white"><span className="sr-only">Idioma / Language</span><select aria-label="Idioma / Language" value={language} onChange={event=>{const path=languagePath(window.location.pathname,event.target.value as SiteLanguage);window.location.assign(path+window.location.search+window.location.hash);}} className="h-full max-w-[104px] cursor-pointer appearance-auto rounded-full bg-transparent py-2 pl-3 pr-2 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-white"><option value="es" className="bg-[#111] text-white">Español</option><option value="en" className="bg-[#111] text-white">English</option></select></label>;
}
