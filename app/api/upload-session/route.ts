import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { randomUUID } from "crypto";

// In-memory store for upload sessions (in production, use Redis or DB)
// Each session expires after 30 minutes
const uploadSessions = new Map<string, { createdAt: number; files: string[] }>();

// Clean expired sessions
function cleanExpired() {
  const now = Date.now();
  uploadSessions.forEach((session, id) => {
    if (now - session.createdAt > 30 * 60 * 1000) {
      uploadSessions.delete(id);
    }
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  cleanExpired();

  const sessionId = randomUUID();
  uploadSessions.set(sessionId, { createdAt: Date.now(), files: [] });

  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
  const uploadUrl = `${baseUrl}/upload/${sessionId}`;

  return NextResponse.json({ sessionId, uploadUrl });
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId requerido" }, { status: 400 });
  }

  const session = uploadSessions.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Sesion expirada o invalida" }, { status: 404 });
  }

  // Check expiration
  if (Date.now() - session.createdAt > 30 * 60 * 1000) {
    uploadSessions.delete(sessionId);
    return NextResponse.json({ error: "Sesion expirada" }, { status: 410 });
  }

  return NextResponse.json({ files: session.files });
}

// Mobile page posts uploaded file URLs here
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { sessionId, fileUrl } = body;

  if (!sessionId || !fileUrl) {
    return NextResponse.json({ error: "sessionId y fileUrl requeridos" }, { status: 400 });
  }

  const session = uploadSessions.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Sesion expirada o invalida" }, { status: 404 });
  }

  if (Date.now() - session.createdAt > 30 * 60 * 1000) {
    uploadSessions.delete(sessionId);
    return NextResponse.json({ error: "Sesion expirada" }, { status: 410 });
  }

  session.files.push(fileUrl);
  return NextResponse.json({ success: true, totalFiles: session.files.length });
}
