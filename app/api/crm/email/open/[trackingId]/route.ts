import { NextRequest } from "next/server";
import { registerCrmEmailOpen } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRANSPARENT_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/atpX5QAAAAASUVORK5CYII=",
  "base64"
);

function pixelResponse() {
  return new Response(TRANSPARENT_PIXEL, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(TRANSPARENT_PIXEL.length),
      "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { trackingId: string } }
) {
  const trackingId = params.trackingId.replace(/\.png$/i, "");

  if (trackingId) {
    await registerCrmEmailOpen(trackingId);
  }

  return pixelResponse();
}
