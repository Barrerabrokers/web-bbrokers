import { NextRequest, NextResponse } from "next/server";
import { registerCrmEmailAttachmentOpen } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { trackingId: string } }
) {
  const { tracking } = await registerCrmEmailAttachmentOpen(params.trackingId);

  if (!tracking?.fileUrl) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.redirect(tracking.fileUrl);
}
