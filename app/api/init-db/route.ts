import { NextResponse } from "next/server";
import postgres from "postgres";

// Endpoint para inicializar la base de datos AUTOMATICAMENTE
// Usa la connection string de Postgres directamente
export async function POST() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const projectRef = supabaseUrl
      .replace("https://", "")
      .replace(".supabase.co", "");

    return NextResponse.json(
      {
        error: "Falta la variable DATABASE_URL en Vercel",
        instructions: {
          step1: "Ve a Supabase Settings -> Database",
          url1: `https://supabase.com/dashboard/project/${projectRef}/settings/database`,
          step2: "Copia la 'Connection string' (Transaction pooler)",
          step3: "Reemplaza [YOUR-PASSWORD] con tu password de DB",
          step4: "Agregala en Vercel como DATABASE_URL",
          step5: "Haz redeploy y vuelve a llamar este endpoint",
        },
      },
      { status: 400 }
    );
  }

  let sql;
  try {
    sql = postgres(databaseUrl, {
      ssl: "require",
      max: 1,
    });

    // Ejecutar SQL paso a paso
    const results: any[] = [];

    // 1. Habilitar extensión
    await sql.unsafe(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    results.push("Extension uuid-ossp habilitada");

    // 2. Crear tabla agents
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS agents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        photo TEXT,
        role VARCHAR(20) DEFAULT 'agent',
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    results.push("Tabla agents creada");

    // 3. Crear tabla property_images
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS property_images (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        storage_path TEXT,
        display_order INTEGER DEFAULT 0,
        is_primary BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    results.push("Tabla property_images creada");

    // 4. Crear tabla contacts
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS contacts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        message TEXT NOT NULL,
        property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'nuevo',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    results.push("Tabla contacts creada");

    // 5. Crear admin inicial
    await sql.unsafe(`
      INSERT INTO agents (name, email, password, phone, role, active)
      VALUES (
        'Admin Barrera',
        'admin@barrerabrokers.com',
        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        '+54 11 1234-5678',
        'admin',
        true
      )
      ON CONFLICT (email) DO NOTHING;
    `);
    results.push("Usuario admin creado/verificado");

    await sql.end();

    return NextResponse.json({
      success: true,
      message: "Base de datos inicializada correctamente",
      results,
      adminCredentials: {
        email: "admin@barrerabrokers.com",
        password: "admin123",
        note: "Cambiar este password despues del primer login",
      },
    });
  } catch (error: any) {
    if (sql) {
      try {
        await sql.end();
      } catch {}
    }
    return NextResponse.json(
      {
        error: "Error ejecutando SQL",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}
