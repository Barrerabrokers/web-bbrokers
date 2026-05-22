import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase";

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

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No se enviaron archivos" },
        { status: 400 }
      );
    }

    const supabase = getServerSupabase();
    const uploadedUrls: string[] = [];

    for (const file of files) {
      // Validar que sea imagen
      if (!file.type.startsWith("image/")) {
        continue;
      }

      // Validar tamaño (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: `Archivo ${file.name} es muy grande (max 5MB)` },
          { status: 400 }
        );
      }

      // Generar nombre único
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const filePath = `properties/${fileName}`;

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
