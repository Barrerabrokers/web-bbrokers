import {NextRequest,NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth';
import {canManageListings,canViewAllCrmContacts} from '@/lib/roles';
import {getSharedDatabase,releaseSharedDatabase} from '@/lib/database-pool';
import {campaignExpression,developmentExpression,exportFiltersSchema,exportWhere,exportPhone} from '@/lib/crm-export';
import {buildMetaAudience} from '@/lib/crm-meta-export';
import * as XLSX from 'xlsx';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=120;
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
async function access(){const s=await getServerSession(authOptions);return s&&canManageListings(s.user.role)?s:null;}
export async function GET(){
 const s=await access();if(!s)return NextResponse.json({error:'No autorizado'},{status:403,headers});
 const sql=getSharedDatabase();try{const q=exportWhere(exportFiltersSchema.parse({}),s.user.id,canViewAllCrmContacts(s.user.role));
 const rows=await sql.unsafe(`SELECT DISTINCT ${developmentExpression} AS development,${campaignExpression} AS campaign,l.assigned_agent_id AS owner_id,COALESCE(a.name,'Sin propietario') AS owner_name FROM crm_leads l LEFT JOIN developments d ON d.id=l.development_id LEFT JOIN agents a ON a.id=l.assigned_agent_id ${q.where}`,q.values);
 return NextResponse.json({developments:[...new Set(rows.map(r=>r.development).filter(Boolean))].sort(),campaigns:[...new Set(rows.map(r=>r.campaign))].sort(),owners:[...new Map(rows.map(r=>[r.owner_id||'unassigned',{id:r.owner_id||'unassigned',name:r.owner_name}])).values()].sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'))},{headers});
 }catch{return NextResponse.json({error:'No se pudieron cargar los filtros'},{status:500,headers});}finally{await releaseSharedDatabase(sql);}
}
export async function POST(req:NextRequest){
 const s=await access();if(!s)return NextResponse.json({error:'No autorizado'},{status:403,headers});
 const parsed=exportFiltersSchema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Revisá los filtros y el rango de fechas'},{status:400,headers});
 const sql=getSharedDatabase();try{const q=exportWhere(parsed.data,s.user.id,canViewAllCrmContacts(s.user.role));
 const rows=await sql.unsafe(`SELECT l.first_name,l.last_name,l.email,l.phone,l.country_code FROM crm_leads l LEFT JOIN developments d ON d.id=l.development_id ${q.where} ORDER BY l.created_at DESC,l.id ASC LIMIT 100001`,q.values);
 if(rows.length>100000)return NextResponse.json({error:'La selección supera 100.000 contactos. Acotá los filtros.'},{status:422,headers});
 if(!rows.length)return NextResponse.json({error:'No hay contactos que coincidan con esos filtros.'},{status:404,headers});
 if(parsed.data.format==='meta'){
  const result=buildMetaAudience(rows.map(r=>({first_name:r.first_name,last_name:r.last_name,email:r.email,phone:r.phone,country_code:r.country_code})));
  if(!result.count)return NextResponse.json({error:'No hay contactos con email o teléfono internacional válido para Meta.'},{status:422,headers});
  return new NextResponse(result.csv,{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="clientes-meta-${new Date().toISOString().slice(0,10)}.csv"`,'X-Export-Count':String(result.count),'X-Export-Omitted':String(result.omitted),'X-Export-Duplicates':String(result.duplicates)}});
 }
 const data=[['Nombre','Apellido','Email','Teléfono con código de país y área'],...rows.map(r=>[r.first_name||'',r.last_name||'',r.email||'',exportPhone(r.phone,r.country_code)])];
 const sheet=XLSX.utils.aoa_to_sheet(data);sheet['!cols']=[{wch:24},{wch:28},{wch:42},{wch:32}];sheet['!autofilter']={ref:sheet['!ref']!};
 // String cells preserve +/zeros and cannot execute spreadsheet formulas.
 for(const key of Object.keys(sheet)){if(!key.startsWith('!')){sheet[key].t='s';sheet[key].z='@';delete sheet[key].f;}}
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Clientes');const bytes=XLSX.write(book,{type:'buffer',bookType:'xlsx'});
 return new NextResponse(new Uint8Array(bytes),{headers:{...headers,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="clientes-${new Date().toISOString().slice(0,10)}.xlsx"`,'X-Export-Count':String(rows.length)}});
 }catch{return NextResponse.json({error:'No se pudo exportar. Intentá nuevamente.'},{status:500,headers});}finally{await releaseSharedDatabase(sql);}
}
