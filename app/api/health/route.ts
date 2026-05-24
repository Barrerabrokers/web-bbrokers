import { NextResponse } from "next/server";

/**
 * Endpoint de diagnostico para verificar que todas las variables
 * de entorno necesarias esten configuradas en el deploy.
 *
 * No expone los VALORES, solo si estan presentes (true/false) y la longitud.
 * Acceder en: /api/health
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REQUIRED_VARS = [
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const OPTIONAL_VARS = [
  "DATABASE_URL",
  "POSTGRES_URL_NON_POOLING",
  "POSTGRES_URL",
];

export async function GET() {
  const required: Record<string, { present: boolean; length: number }> = {};
  const optional: Record<string, { present: boolean; length: number }> = {};

  let allRequiredPresent = true;

  for (const key of REQUIRED_VARS) {
    const value = process.env[key];
    const present = !!value && value.length > 0;
    required[key] = { present, length: value?.length || 0 };
    if (!present) allRequiredPresent = false;
  }

  for (const key of OPTIONAL_VARS) {
    const value = process.env[key];
    optional[key] = { present: !!value, length: value?.length || 0 };
  }

  return NextResponse.json(
    {
      status: allRequiredPresent ? "ok" : "missing-config",
      vercelEnv: process.env.VERCEL_ENV || "unknown",
      vercelUrl: process.env.VERCEL_URL || null,
      nodeEnv: process.env.NODE_ENV,
      required,
      optional,
      hint: allRequiredPresent
        ? "Todas las variables requeridas estan configuradas."
        : "Faltan variables requeridas. Configurarlas en Vercel > Settings > Environment Variables.",
    },
    {
      status: allRequiredPresent ? 200 : 500,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
