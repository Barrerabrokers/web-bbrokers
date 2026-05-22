import { NextResponse } from "next/server";
import postgres from "postgres";
import { getServerSupabase } from "@/lib/supabase";

export async function POST() {
  // Intentar usar cualquiera de las variables que pueda haber configurado Vercel/Supabase
  const databaseUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.SUPABASE_DB_URL;

  const results: any[] = [];

  // Mostrar qué variable está usando
  if (databaseUrl) {
    if (process.env.DATABASE_URL) results.push("Usando DATABASE_URL");
    else if (process.env.POSTGRES_URL_NON_POOLING) results.push("Usando POSTGRES_URL_NON_POOLING");
    else if (process.env.POSTGRES_URL) results.push("Usando POSTGRES_URL");
    else if (process.env.POSTGRES_PRISMA_URL) results.push("Usando POSTGRES_PRISMA_URL");
    else if (process.env.SUPABASE_DB_URL) results.push("Usando SUPABASE_DB_URL");
  }

  // ========================================
  // 1. CREAR TABLAS Y POLITICAS
  // ========================================
  if (databaseUrl) {
    let sql;
    try {
      sql = postgres(databaseUrl, {
        ssl: "require",
        max: 1,
        prepare: false,
      });

      await sql.unsafe(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
      results.push("Extension uuid-ossp habilitada");

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
      results.push("Tabla agents OK");

      // ALTER TABLE: agregar columnas faltantes en properties si la tabla ya existia
      const propertyColumns = [
        { name: "agent_id", type: "UUID" },
        { name: "currency", type: "VARCHAR(3) DEFAULT 'USD'" },
        { name: "featured", type: "BOOLEAN DEFAULT false" },
        { name: "bedrooms", type: "INTEGER" },
        { name: "bathrooms", type: "INTEGER" },
        { name: "features", type: "TEXT[] DEFAULT '{}'" },
        { name: "status", type: "VARCHAR(20) DEFAULT 'disponible'" },
        { name: "updated_at", type: "TIMESTAMPTZ DEFAULT NOW()" },
      ];

      for (const col of propertyColumns) {
        try {
          await sql.unsafe(
            `ALTER TABLE properties ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`
          );
          results.push(`Columna ${col.name} OK`);
        } catch (e: any) {
          results.push(`Error columna ${col.name}: ${e.message}`);
        }
      }

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

      // Borrar todas las políticas viejas
      const oldPolicies = [
        "Public Access",
        "Anyone can upload",
        "Anyone can update",
        "Anyone can delete",
        "Properties public read",
        "Properties public upload",
        "Properties public update",
        "Properties public delete",
        "properties_public_select",
        "properties_public_insert",
        "properties_public_update",
        "properties_public_delete",
      ];

      for (const policyName of oldPolicies) {
        try {
          await sql.unsafe(`DROP POLICY IF EXISTS "${policyName}" ON storage.objects;`);
        } catch {}
      }
      results.push("Politicas viejas eliminadas");

      // Crear nuevas políticas con TO public
      try {
        await sql.unsafe(`
          CREATE POLICY "properties_public_select"
          ON storage.objects FOR SELECT
          TO public
          USING (bucket_id = 'properties');
        `);
        results.push("Politica SELECT creada (public)");
      } catch (e: any) {
        results.push(`Error politica SELECT: ${e.message}`);
      }

      try {
        await sql.unsafe(`
          CREATE POLICY "properties_public_insert"
          ON storage.objects FOR INSERT
          TO public
          WITH CHECK (bucket_id = 'properties');
        `);
        results.push("Politica INSERT creada (public)");
      } catch (e: any) {
        results.push(`Error politica INSERT: ${e.message}`);
      }

      try {
        await sql.unsafe(`
          CREATE POLICY "properties_public_update"
          ON storage.objects FOR UPDATE
          TO public
          USING (bucket_id = 'properties')
          WITH CHECK (bucket_id = 'properties');
        `);
        results.push("Politica UPDATE creada (public)");
      } catch (e: any) {
        results.push(`Error politica UPDATE: ${e.message}`);
      }

      try {
        await sql.unsafe(`
          CREATE POLICY "properties_public_delete"
          ON storage.objects FOR DELETE
          TO public
          USING (bucket_id = 'properties');
        `);
        results.push("Politica DELETE creada (public)");
      } catch (e: any) {
        results.push(`Error politica DELETE: ${e.message}`);
      }

      await sql.end();
    } catch (error: any) {
      if (sql) {
        try {
          await sql.end();
        } catch {}
      }
      results.push(`Error SQL: ${error.message}`);
    }
  } else {
    results.push("ERROR: No se encontro ninguna variable de conexion (DATABASE_URL, POSTGRES_URL, etc)");
    results.push("Variables disponibles: " + Object.keys(process.env).filter(k => k.includes("POSTGRES") || k.includes("SUPABASE") || k.includes("DATABASE")).join(", "));
  }

  // ========================================
  // 2. CREAR/VERIFICAR STORAGE BUCKET
  // ========================================
  try {
    const supabase = getServerSupabase();

    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      results.push(`Error listando buckets: ${listError.message}`);
    } else {
      const exists = buckets?.find((b: any) => b.name === "properties");

      if (exists) {
        const { error: updateError } = await supabase.storage.updateBucket("properties", {
          public: true,
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/jpg"],
          fileSizeLimit: 10485760,
        });
        if (updateError) {
          results.push(`Error actualizando bucket: ${updateError.message}`);
        } else {
          results.push("Bucket 'properties' actualizado (publico)");
        }
      } else {
        const { error: bucketError } = await supabase.storage.createBucket("properties", {
          public: true,
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/jpg"],
          fileSizeLimit: 10485760,
        });

        if (bucketError) {
          results.push(`Error creando bucket: ${bucketError.message}`);
        } else {
          results.push("Bucket 'properties' creado (publico)");
        }
      }
    }
  } catch (error: any) {
    results.push(`Error storage: ${error.message}`);
  }

  return NextResponse.json({
    success: true,
    message: "Inicializacion completada",
    results,
    adminCredentials: {
      email: "admin@barrerabrokers.com",
      password: "admin123",
    },
  });
}

export async function GET() {
  return POST();
}
