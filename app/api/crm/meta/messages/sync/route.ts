import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncMetaMessages } from "@/lib/meta-message-sync";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const schema = z.object({ channel: z.enum(["instagram", "facebook"]), after: z.string().max(4096).optional() });

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Canal inválido" }, { status: 400 });
  try { return NextResponse.json(await syncMetaMessages(parsed.data.channel, parsed.data.after)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error && error.name === "TimeoutError" ? "Meta tardó demasiado en responder. Reintentá la sincronización en unos minutos." : error instanceof Error ? error.message : "No se pudieron recuperar los mensajes" }, { status: 424 }); }
}
