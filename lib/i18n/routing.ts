export type SiteLanguage = 'es' | 'en';
export function spanishPath(path:string) {return path.replace(/^\/en(?=\/|$)/,'')||'/';}
export function isPublicSitePath(path:string) {
 const p=spanishPath(path);
 return p==='/'||/^\/(?:contacto|blog|desarrollos|propiedades|ciudad-de-buenos-aires|inversiones-real-estate-buenos-aires|invertir-en-real-estate-argentina|politica-de-privacidad)(?:\/|$)/.test(p);
}
export function languagePath(path:string,language:SiteLanguage) {
 const plain=spanishPath(path);
 return language==='en'?'/en'+(plain==='/'?'':plain):plain;
}
export function publicLanguage(path:string):SiteLanguage {return /^\/en(?:\/|$)/.test(path)&&isPublicSitePath(path)?'en':'es';}
