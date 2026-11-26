import {NextRequest,NextResponse} from 'next/server';
import {syncVibeFromDrive} from '@/lib/vibe-drive-sync';
import {syncAlmaFromDrive} from '@/lib/alma-drive-sync';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;
export async function GET(request:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'No autorizado'},{status:401});
 try{const results=await Promise.allSettled([syncVibeFromDrive(),syncAlmaFromDrive()]); const ok=results.every(r=>r.status==='fulfilled');return NextResponse.json({ok,results:results.map((r,i)=>({slug:i===0?'vibe-bonpland':'alma-centenario',...(r.status==='fulfilled'?r.value:{error:'Se conserva la última carga válida'})}))},{status:ok?200:503});}
 catch{console.error('vibe_drive_sync_failed');return NextResponse.json({ok:false,error:'No se pudo sincronizar. Se conserva la última carga válida.'},{status:503});}
}
