import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageSiteSettings } from "@/lib/roles";
import { normalizeAllPriceListsUrl, saveAllPriceListsUrl, normalizePriceListEntry, addSharedPriceList, removeSharedPriceList } from "@/lib/all-price-lists";
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageSiteSettings(session.user.role)) return NextResponse.json({error:"No autorizado"},{status:403});
  let url: string;
  try { url = normalizeAllPriceListsUrl((await request.json()).url); }
  catch { return NextResponse.json({error:"Pegá un enlace válido de Google Drive o Google Sheets."},{status:400}); }
  try { await saveAllPriceListsUrl(url); return NextResponse.json({url}); }
  catch { return NextResponse.json({error:"No se pudo guardar el enlace. Volvé a intentar."},{status:500}); }
}

export async function POST(request: NextRequest) {
  const session=await getServerSession(authOptions);
  if(!session||!canManageSiteSettings(session.user.role))return NextResponse.json({error:"No autorizado"},{status:403});
  let entry:{url:string;description:string};
  try{entry=normalizePriceListEntry(await request.json());}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Revisá el enlace y la descripción."},{status:400});}
  try{return NextResponse.json({entry:await addSharedPriceList(entry)},{status:201});}
  catch{return NextResponse.json({error:"No se pudo agregar la lista. Volvé a intentar."},{status:500});}
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !canManageSiteSettings(session.user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id || !/^price-list:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "La lista no es válida." }, { status: 400 });
  }

  try {
    await removeSharedPriceList(id);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "No se pudo quitar la lista. Volvé a intentar." }, { status: 500 });
  }
}
