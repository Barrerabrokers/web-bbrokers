import { NextRequest,NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readMiaWorkspace } from '@/lib/mia-admin-workspace';
import { z } from 'zod';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const session=await getServerSession(authOptions);
 if(session?.user.role!=='admin')return NextResponse.json({error:'Solo administradores.'},{status:403,headers:{'Cache-Control':'no-store'}});
 const parsed=z.object({section:z.enum(['contacts','detail','learnings','meetings']).default('contacts'),q:z.string().trim().max(120).default(''),page:z.coerce.number().int().min(0).max(10000).default(0),leadId:z.string().uuid().optional()}).safeParse(Object.fromEntries(request.nextUrl.searchParams));
 if(!parsed.success||parsed.data.section==='detail'&&!parsed.data.leadId)return NextResponse.json({error:'Revisá los filtros de búsqueda.'},{status:400});
 try{const data=await readMiaWorkspace(parsed.data);return NextResponse.json(data||{error:'No se encontró el contacto.'},{status:data?200:404,headers:{'Cache-Control':'private, no-store'}});}
 catch{console.warn('mia-workspace-unavailable');return NextResponse.json({error:'No se pudo cargar la información de MIA. Volvé a intentar.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
