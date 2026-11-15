import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { canManageSiteSettings } from "@/lib/roles";
import { catalogOrderSchema } from "@/lib/catalog-order";
import { saveCatalogOrder } from "@/lib/catalog-order-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!canManageSiteSettings(session?.user.role)) return NextResponse.json({ error: "Solo administración y marketing pueden ordenar el catálogo." }, { status: 403 });
  const parsed = catalogOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá el orden: cada ficha debe aparecer una sola vez." }, { status: 400 });
  try {
    const result = await saveCatalogOrder(parsed.data);
    if (result.status === 200) {
      for (const path of ["/", "/propiedades", "/desarrollos", "/ciudad-de-buenos-aires", "/inversiones-real-estate-buenos-aires"]) revalidatePath(path);
    }
    return NextResponse.json(result, { status: result.status, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar el orden. Volvé a intentarlo." }, { status: 500 });
  }
}
