import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCrmEmailAccountWithSecret } from "@/lib/db";
import { hasGoogleCalendarAccess } from "@/lib/google-calendar-connection";
import { canManageListings } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !canManageListings(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const account = await getCrmEmailAccountWithSecret(session.user.id);
  return NextResponse.json({ connected: hasGoogleCalendarAccess(account) }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
