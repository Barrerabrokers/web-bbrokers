import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createUnit,
  getDevelopmentById,
  getUnitsByDevelopment,
} from "@/lib/developments-db";
import { parsePriceListPdf } from "@/lib/price-list-parser";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const development = await getDevelopmentById(params.id);
    if (!development) {
      return NextResponse.json(
        { error: "Desarrollo no encontrado" },
        { status: 404 }
      );
    }

    const priceListUrl = body.priceListUrl || development.priceListUrl;
    if (!priceListUrl) {
      return NextResponse.json(
        { error: "El desarrollo no tiene lista de precios PDF" },
        { status: 400 }
      );
    }

    const pdfResponse = await fetch(priceListUrl);
    if (!pdfResponse.ok) {
      return NextResponse.json(
        { error: "No se pudo descargar la lista de precios" },
        { status: 400 }
      );
    }

    const contentType = pdfResponse.headers.get("content-type") || "";
    const looksLikePdf =
      contentType.includes("application/pdf") ||
      new URL(priceListUrl).pathname.toLowerCase().endsWith(".pdf");

    if (!looksLikePdf) {
      return NextResponse.json(
        { error: "La lista de precios debe ser un PDF" },
        { status: 400 }
      );
    }

    const arrayBuffer = await pdfResponse.arrayBuffer();
    if (arrayBuffer.byteLength > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "La lista de precios es muy grande (máx 10MB)" },
        { status: 400 }
      );
    }

    const parsed = await parsePriceListPdf(Buffer.from(arrayBuffer));
    if (parsed.units.length === 0) {
      return NextResponse.json(
        {
          error:
            "No pude detectar unidades en el PDF. Revisá que tenga unidad, m² y precio por fila.",
          ignoredLines: parsed.ignoredLines,
        },
        { status: 422 }
      );
    }

    const existingUnits = await getUnitsByDevelopment(params.id);
    const existingNumbers = new Set(
      existingUnits.map((unit) => unit.unitNumber.trim().toLowerCase())
    );

    const created: string[] = [];
    const skipped: string[] = [];
    const failed: { unitNumber: string; error: string }[] = [];

    for (const unit of parsed.units) {
      const key = unit.unitNumber.trim().toLowerCase();
      if (existingNumbers.has(key)) {
        skipped.push(unit.unitNumber);
        continue;
      }

      const { error } = await createUnit({
        developmentId: params.id,
        ...unit,
      });

      if (error) {
        failed.push({ unitNumber: unit.unitNumber, error });
        continue;
      }

      existingNumbers.add(key);
      created.push(unit.unitNumber);
    }

    return NextResponse.json({
      message: "Lista de precios analizada",
      detected: parsed.units.length,
      created: created.length,
      skipped: skipped.length,
      failed: failed.length,
      createdUnits: created,
      skippedUnits: skipped,
      failedUnits: failed,
      ignoredLines: parsed.ignoredLines,
    });
  } catch (error: any) {
    console.error("Price list import error:", error);
    return NextResponse.json(
      { error: error.message || "Error importando lista de precios" },
      { status: 500 }
    );
  }
}
