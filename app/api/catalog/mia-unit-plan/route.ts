import { NextRequest,NextResponse } from 'next/server';
import { readMiaUnitPlan } from '@/lib/mia-unit-plans';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest) {
  const unit=request.nextUrl.searchParams.get('unit')||'';
  try{const bytes=await readMiaUnitPlan(request.nextUrl.searchParams.get('project')||'',unit,Number(request.nextUrl.searchParams.get('area')));return new NextResponse(new Uint8Array(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="plano-unidad-${unit}.pdf"`,'Cache-Control':'public, max-age=120','X-Content-Type-Options':'nosniff'}});}
  catch{return NextResponse.json({error:'No se pudo verificar el plano de esta unidad.'},{status:404});}
}
