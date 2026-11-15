import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ error: "Esta función fue retirada." }, { status: 410 });
}

export const POST = GET;
