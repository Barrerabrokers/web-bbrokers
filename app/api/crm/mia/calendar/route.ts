import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSharedDatabase,releaseSharedDatabase } from '@/lib/database-pool';
import { getMiaMeetingConfig,miaMeetingCalendar } from '@/lib/mia-meetings';
import { getCrmCalendarBusy } from '@/lib/crm-calendar-availability';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(){
 const session=await getServerSession(authOptions);
 if(session?.user.role!=='admin')return Response.json({error:'Solo administradores.'},{status:403});
 const headers={'Cache-Control':'private, no-store'};
 const sql=getSharedDatabase();
 try{
 const config=await getMiaMeetingConfig();if(!config)return Response.json({error:'El agendamiento de MIA no está habilitado.'},{status:409,headers});
 const agents=await sql`SELECT id,name,email FROM agents WHERE lower(email) IN ('pablo@barrerabrokers.com','lucas@barrerabrokers.com') AND role='admin' AND active=TRUE ORDER BY name`;
 const calendars=await Promise.all(agents.map(async agent=>{try{
 const token=await miaMeetingCalendar({...config,organizerId:agent.id});await getCrmCalendarBusy(token,new Date(),new Date(Date.now()+86400000));
 return {name:agent.name,verified:true,self:agent.id===session.user.id};
 }catch{return {name:agent.name,verified:false,self:agent.id===session.user.id};}}));
 return Response.json({ready:calendars.length===2&&calendars.every(c=>c.verified),calendars,checkedAt:new Date().toISOString()},{headers});
 }catch{return Response.json({error:'No se pudo completar la comprobación. Reintentá en unos minutos.'},{status:503,headers});}finally{await releaseSharedDatabase(sql);}
}
