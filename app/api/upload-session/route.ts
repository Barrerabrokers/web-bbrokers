import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageListings } from "@/lib/roles";
import { randomUUID } from "crypto";
import {
  appendMobileUploadSessionFile,
  createMobileUploadSession,
  getMobileUploadSessionFiles,
} from "@/lib/db";

const SESSION_DURATION_MS = 2 * 60 * 60 * 1000;

function getUploadBaseUrl(request: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    request.nextUrl.origin
  ).replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!canManageListings(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const sessionId = randomUUID();
  const created = await createMobileUploadSession({
    id: sessionId,
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  });

  if (!created.success) {
    return NextResponse.json(
      { error: created.error || "No se pudo crear la sesion" },
      { status: 500 }
    );
  }

  const baseUrl = getUploadBaseUrl(request);
  const uploadUrl = `${baseUrl}/upload/${sessionId}`;

  return NextResponse.json({
    sessionId,
    uploadUrl,
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
  });
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId requerido" }, { status: 400 });
  }

  const session = await getMobileUploadSessionFiles(sessionId);
  if (session.expired) {
    return NextResponse.json(
      { error: session.error || "Sesion expirada o invalida" },
      { status: 410 }
    );
  }
  if (session.error) {
    return NextResponse.json({ error: session.error }, { status: 500 });
  }

  return NextResponse.json({ files: session.files || [] });
}

// Mobile page posts uploaded file URLs here
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { sessionId, fileUrl } = body;

  if (!sessionId || !fileUrl) {
    return NextResponse.json({ error: "sessionId y fileUrl requeridos" }, { status: 400 });
  }

  const result = await appendMobileUploadSessionFile({ id: sessionId, fileUrl });
  if (result.expired) {
    return NextResponse.json(
      { error: result.error || "Sesion expirada o invalida" },
      { status: 410 }
    );
  }
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "No se pudo guardar el archivo" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, totalFiles: result.totalFiles });
}
