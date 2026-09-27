import {getServerSession} from "next-auth";
import {redirect} from "next/navigation";
import {authOptions} from "@/lib/auth";
import {CrmClients} from "@/components/admin/crm-clients";
import {CrmNav} from "@/components/admin/crm-nav";
export const dynamic="force-dynamic";
export default async function ClientsPage() {
  const session=await getServerSession(authOptions);
  if(session?.user.role!=="admin")redirect("/admin/crm");
  return <><CrmNav/><CrmClients/></>;
}
