import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCrmLeads } from "@/lib/db";
import { canManageListings, canViewAllCrmContacts } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const leads = await getCrmLeads({
    agentId: session.user.id,
    includeAll: canViewAllCrmContacts(session.user.role),
  });

  return NextResponse.json({
    leads: leads.map(({ id, firstName, lastName, email, countryCode, phone }) => ({
      id,
      firstName,
      lastName,
      email,
      countryCode,
      phone,
    })),
  });
}
