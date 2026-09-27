import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Database migrations must never be accessible over HTTP, even to an admin.
function retired() {
  return NextResponse.json({ error: "Ruta deshabilitada." }, {
    status: 410, headers: { "Cache-Control": "no-store" },
  });
}
export const GET = retired;
export const POST = retired;
