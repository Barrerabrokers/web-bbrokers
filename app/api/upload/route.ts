import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";
import { canManageListings, canManageSiteSettings } from "@/lib/roles";

// Route segment config: increase body size limit for PDF uploads
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const folder = (formData.get("folder") as string) || "properties";
    const role = session.user.role;

    // Validar folder permitido
    const allowedFolders = [
      "properties",
      "developments",
      "units",
      "agents",
      "brochures",
      "price-lists",
      "settings",
      "quotes",
      "templates",
    ];
    const safeFolder = allowedFolders.includes(folder) ? folder : "properties";

    if (safeFolder === "settings" && !canManageSiteSettings(role)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (safeFolder !== "settings" && !canManageListings(role)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No se enviaron archivos" },
        { status: 400 }
      );
    }

    const supabase = getServerSupabase();
    const uploadedUrls: string[] = [];

    const allowedTypes = [
      "image/",
      "video/",
      "application/pdf",
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const allowedExtensions = ["pdf", "xls", "xlsx", "csv", "jpg", "jpeg", "png", "webp", "gif", "mp4", "mov", "m4v", "webm"];

    for (const file of files) {
      // Validar que sea imagen, PDF o planilla
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const isPriceListUpload = safeFolder === "price-lists";
      const isPdf = file.type === "application/pdf" || ext === "pdf";
      const isExcel =
        file.type === "application/vnd.ms-excel" ||
        file.type ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        ext === "xls" ||
        ext === "xlsx";

      if (isPriceListUpload && !isPdf && !isExcel) {
        return NextResponse.json(
          { error: "La lista de precios debe ser un archivo PDF o Excel" },
          { status: 400 }
        );
      }

      const isAllowed =
        allowedTypes.some((t) => file.type.startsWith(t)) ||
        allowedExtensions.includes(ext);
      if (!isAllowed) {
        return NextResponse.json(
          { error: `Tipo de archivo no permitido: ${file.type}` },
          { status: 400 }
        );
      }

      // Validar tamaño (max 50MB para videos, 20MB para documentos, 5MB para imágenes)
      const isVideo = file.type.startsWith("video/");
      const isDocument = !file.type.startsWith("image/") && !isVideo;
      const maxSize = isVideo ? 50 * 1024 * 1024 : isDocument ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
      const maxLabel = isVideo ? "50MB" : isDocument ? "20MB" : "5MB";
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: `Archivo ${file.name} es muy grande (max ${maxLabel})` },
          { status: 400 }
        );
      }

      // Generar nombre único
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const filePath = `${safeFolder}/${fileName}`;

      // Convertir File a ArrayBuffer
      const buffer = await file.arrayBuffer();

      // Subir a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("properties")
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        return NextResponse.json(
          { error: `Error subiendo archivo: ${uploadError.message}` },
          { status: 500 }
        );
      }

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from("properties")
        .getPublicUrl(filePath);

      uploadedUrls.push(urlData.publicUrl);
    }

    return NextResponse.json(
      {
        message: "Archivos subidos exitosamente",
        urls: uploadedUrls,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Error al subir archivos" },
      { status: 500 }
    );
  }
}
