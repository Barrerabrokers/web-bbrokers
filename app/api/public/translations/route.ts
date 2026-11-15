import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { translatePublicTexts } from '@/lib/i18n/translation';
export const dynamic='force-dynamic';
export const maxDuration=60;
const input=z.object({texts:z.array(z.string().trim().min(1).max(1800)).min(1).max(60)}).refine(v=>v.texts.join('').length<=16000);
export async function POST(request:NextRequest) {
 const origin=request.headers.get('origin');
 if(origin&&(()=>{try{return new URL(origin).host!==(request.headers.get('host')||request.nextUrl.host);}catch{return true;}})())return NextResponse.json({error:'Invalid origin'},{status:403});
 const body=input.safeParse(await request.json().catch(()=>null));
 if(!body.success)return NextResponse.json({error:'Invalid translation request'},{status:400});
 try {const result=await translatePublicTexts(body.data.texts,{client:request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'unknown'});return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});}
 catch(error){const limited=error instanceof Error&&error.message==='TRANSLATION_LIMIT';console.warn('public-site-translation',{reason:limited?'rate_limit':'temporarily_unavailable'});return NextResponse.json({error:'Translation temporarily unavailable'},{status:limited?429:503});}
}
