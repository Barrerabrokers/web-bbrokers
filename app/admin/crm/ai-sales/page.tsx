import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { canManageListings } from '@/lib/roles';
import { AiSales } from '@/components/admin/ai-sales';
import { CrmNav } from '@/components/admin/crm-nav';
export const dynamic='force-dynamic';
export default async function Page(){const s=await getServerSession(authOptions);if(!s||!canManageListings(s.user.role))redirect('/login');return <><CrmNav/><div className="mx-auto max-w-[1500px] p-4 md:p-6"><AiSales/></div></>;}
