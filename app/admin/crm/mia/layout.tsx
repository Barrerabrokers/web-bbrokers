import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
export const dynamic='force-dynamic';
export default async function MiaLayout({children}:{children:React.ReactNode}){
 const session=await getServerSession(authOptions);
 if(!session)redirect('/login?from=/admin/crm/mia');
 if(session.user.role!=='admin')redirect('/admin/crm');
 return children;
}
