import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { headers } from "next/headers";
import { loginDestination } from "@/lib/login-destination";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    const destination = loginDestination((await headers()).get("x-admin-destination"));
    redirect(`/login?from=${encodeURIComponent(destination)}`);
  }
  return <AdminShell session={session}>{children}</AdminShell>;
}
