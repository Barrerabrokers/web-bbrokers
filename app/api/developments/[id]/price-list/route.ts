import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDevelopmentById } from "@/lib/developments-db";
import { canManageListings } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!canManageListings(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const development = await getDevelopmentById(params.id);
  if (!development?.priceListUrl) {
    return NextResponse.json(
      { error: "Lista de precios no encontrada" },
      { status: 404 }
    );
  }

  const priceListUrl = new URL(development.priceListUrl);
  if (
    priceListUrl.hostname === "drive.google.com" ||
    priceListUrl.hostname === "docs.google.com"
  ) {
    return NextResponse.redirect(priceListUrl);
  }

  const fileResponse = await fetch(priceListUrl, {
    cache: "no-store",
  });

  if (!fileResponse.ok) {
    return NextResponse.json(
      { error: "No se pudo descargar la lista de precios" },
      { status: 502 }
    );
  }

  const contentType =
    fileResponse.headers.get("content-type") || "application/octet-stream";
  const pathname = priceListUrl.pathname;
  const fallbackName = `lista-precios-${development.slug}`;
  const fileName =
    decodeURIComponent(pathname.split("/").pop() || fallbackName) ||
    fallbackName;

  return new NextResponse(fileResponse.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
