import { NextResponse, type NextRequest } from "next/server";
import { isPublicSitePath,publicLanguage,spanishPath } from "@/lib/i18n/routing";
export function middleware(request:NextRequest) {
 const headers=new Headers(request.headers),path=request.nextUrl.pathname;
 headers.set('x-public-language',isPublicSitePath(path)?publicLanguage(path):'es');
 headers.set('x-public-path',path);
 if(path==='/admin'||path.startsWith('/admin/'))headers.set('x-admin-destination',path+request.nextUrl.search);
 if(publicLanguage(path)==='en'){const url=request.nextUrl.clone();url.pathname=spanishPath(path);return NextResponse.rewrite(url,{request:{headers}});}
 return NextResponse.next({request:{headers}});
}
export const config={matcher:['/((?!api(?:/|$)|_next(?:/|$)|.*\\..*).*)']};
