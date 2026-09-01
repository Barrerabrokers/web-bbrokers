import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { canManageListings } from "@/lib/roles";
import { getMeetingLinkByAgent, saveMeetingLink } from "@/lib/meeting-scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(3).max(120),
  location: z.string().trim().min(1).max(160),
  meetingModes: z.array(z.enum(["in_person", "google_meet"])).min(1),
  durations: z.array(z.number().int().min(10).max(180)).min(1),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotInterval: z.number().int().min(10).max(60),
  active: z.boolean(),
});

async function session() {
  const value = await getServerSession(authOptions);
  return value && canManageListings(value.user.role) ? value : null;
}

export async function GET() {
  const auth = await session();
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  return NextResponse.json({ meetingLink: await getMeetingLinkByAgent(auth.user.id) });
}

export async function POST(request: Request) {
  const auth = await session();
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.startTime >= parsed.data.endTime) {
    return NextResponse.json({ error: "Revisá el enlace, los días y el rango horario." }, { status: 400 });
  }
  try {
    const meetingLink = await saveMeetingLink(auth.user.id, parsed.data);
    return NextResponse.json({ meetingLink });
  } catch (error: any) {
    const duplicate = error?.code === "23505";
    return NextResponse.json({ error: duplicate ? "Ese nombre de enlace ya está en uso." : "No se pudo guardar la configuración." }, { status: duplicate ? 409 : 500 });
  }
}
