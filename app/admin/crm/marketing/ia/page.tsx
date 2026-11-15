import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export default async function AiTrainingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login?from=/admin/crm/marketing/ia');
  if (session.user.role !== 'admin') redirect('/admin/crm');
  redirect('/admin/crm/mia?section=aprendizaje');
}
