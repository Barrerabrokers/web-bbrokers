import { NextResponse } from "next/server";
import { getTeamMembers } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const team = await getTeamMembers();
    return NextResponse.json(team);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error al obtener equipo" },
      { status: 500 }
    );
  }
}
