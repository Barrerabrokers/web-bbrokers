import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { exportMiaLearningDocuments } from '@/lib/mia-learnings';
export const dynamic='force-dynamic';
export async function GET(){
 const session=await getServerSession(authOptions);
 if(session?.user.role!=='admin')return Response.json({error:'Solo administradores.'},{status:403});
 try{return new Response(JSON.stringify(await exportMiaLearningDocuments(),null,2),{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="mia_learnings.json"','Cache-Control':'private, no-store'}});}catch{return Response.json({error:'No se pudo exportar el aprendizaje.'},{status:503});}
}
