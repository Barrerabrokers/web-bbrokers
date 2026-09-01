import { NextResponse, NextRequest } from "next/server";
import postgres from "postgres";
import { getServerSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const databaseUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.SUPABASE_DB_URL;

  const results: any[] = [];
  const url = new URL(request.url);
  const reset = url.searchParams.get("reset") === "true";

  if (databaseUrl) {
    if (process.env.DATABASE_URL) results.push("Usando DATABASE_URL");
    else if (process.env.POSTGRES_URL_NON_POOLING) results.push("Usando POSTGRES_URL_NON_POOLING");
    else if (process.env.POSTGRES_URL) results.push("Usando POSTGRES_URL");
    else if (process.env.POSTGRES_PRISMA_URL) results.push("Usando POSTGRES_PRISMA_URL");
    else if (process.env.SUPABASE_DB_URL) results.push("Usando SUPABASE_DB_URL");
  }

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

      // Si reset=true, borrar tablas existentes
      if (reset) {
        try {
          await sql.unsafe(`DROP TABLE IF EXISTS property_images CASCADE;`);
          results.push("DROP property_images OK");
        } catch (e: any) {
          results.push(`Error drop property_images: ${e.message}`);
        }
        try {
          await sql.unsafe(`DROP TABLE IF EXISTS contacts CASCADE;`);
          results.push("DROP contacts OK");
        } catch (e: any) {
          results.push(`Error drop contacts: ${e.message}`);
        }
        try {
          await sql.unsafe(`DROP TABLE IF EXISTS properties CASCADE;`);
          results.push("DROP properties OK");
        } catch (e: any) {
          results.push(`Error drop properties: ${e.message}`);
        }
      }

      // Crear agents
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS agents (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          photo TEXT,
          title VARCHAR(255),
          role VARCHAR(20) DEFAULT 'agent',
          active BOOLEAN DEFAULT false,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      results.push("Tabla agents OK");

      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS agent_password_reset_tokens (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
          token_hash TEXT UNIQUE NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          approve_on_use BOOLEAN DEFAULT false,
          used_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      await sql.unsafe(`
        ALTER TABLE agent_password_reset_tokens
        ADD COLUMN IF NOT EXISTS approve_on_use BOOLEAN DEFAULT false;
      `);
      await sql.unsafe(`
        CREATE INDEX IF NOT EXISTS idx_agent_password_reset_tokens_token_hash
        ON agent_password_reset_tokens(token_hash);
      `);
      await sql.unsafe(`
        CREATE INDEX IF NOT EXISTS idx_agent_password_reset_tokens_agent_id
        ON agent_password_reset_tokens(agent_id);
      `);
      results.push("Tabla agent_password_reset_tokens OK");

      // Crear properties con TODAS las columnas
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS properties (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          title VARCHAR(255) NOT NULL,
          description TEXT,
          category VARCHAR(50),
          price DECIMAL(12,2),
          expenses DECIMAL(12,2),
          currency VARCHAR(3) DEFAULT 'USD',
          location VARCHAR(255),
          address VARCHAR(255),
          area DECIMAL(10,2),
          bedrooms INTEGER,
          bathrooms INTEGER,
          features TEXT[] DEFAULT '{}',
          agent_id UUID,
          status VARCHAR(20) DEFAULT 'disponible',
          visibility VARCHAR(20) DEFAULT 'public',
          video_urls TEXT[] DEFAULT '{}',
          video_is_primary BOOLEAN DEFAULT false,
          featured BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      results.push("Tabla properties OK");

      // ALTER TABLE para asegurar que TODAS las columnas existan
      const propertyColumns = [
        { name: "title", type: "VARCHAR(255)" },
        { name: "description", type: "TEXT" },
        { name: "category", type: "VARCHAR(50)" },
        { name: "price", type: "DECIMAL(12,2)" },
        { name: "expenses", type: "DECIMAL(12,2)" },
        { name: "currency", type: "VARCHAR(3) DEFAULT 'USD'" },
        { name: "location", type: "VARCHAR(255)" },
        { name: "address", type: "VARCHAR(255)" },
        { name: "area", type: "DECIMAL(10,2)" },
        { name: "bedrooms", type: "INTEGER" },
        { name: "bathrooms", type: "INTEGER" },
        { name: "features", type: "TEXT[] DEFAULT '{}'" },
        { name: "agent_id", type: "UUID" },
        { name: "status", type: "VARCHAR(20) DEFAULT 'disponible'" },
        { name: "visibility", type: "VARCHAR(20) DEFAULT 'public'" },
        { name: "video_urls", type: "TEXT[] DEFAULT '{}'" },
        { name: "video_is_primary", type: "BOOLEAN DEFAULT false" },
        { name: "featured", type: "BOOLEAN DEFAULT false" },
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

      try {
        await sql.unsafe(`UPDATE properties SET visibility = 'public' WHERE visibility IS NULL;`);
        await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_properties_visibility ON properties(visibility);`);
        results.push("Indice visibility en properties OK");
      } catch (e: any) {
        results.push(`Error indice visibility properties: ${e.message}`);
      }

      // Listar columnas existentes
      try {
        const cols = await sql`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'properties'
          ORDER BY ordinal_position
        `;
        results.push(
          `Columnas en properties: ${cols.map((c: any) => c.column_name).join(", ")}`
        );
      } catch {}

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
      results.push("Tabla property_images OK");

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
      results.push("Tabla contacts OK");

      await sql.unsafe(`ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;`);
      results.push("RLS de contacts habilitado");

      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS site_settings (
          id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
          company_name VARCHAR(255) NOT NULL DEFAULT 'Barrera Brokers',
          email VARCHAR(255) NOT NULL DEFAULT 'info@barrerabrokers.com',
          phone VARCHAR(50) NOT NULL DEFAULT '+54 11 1234-5678',
          whatsapp VARCHAR(50) NOT NULL DEFAULT '541112345678',
          address_street VARCHAR(255) NOT NULL DEFAULT 'Av. Principal 123',
          address_city VARCHAR(255) NOT NULL DEFAULT 'Buenos Aires, Argentina',
          whatsapp_message TEXT NOT NULL DEFAULT 'Hola! Me interesa conocer más sobre los desarrollos de Barrera Brokers.',
          hero_videos TEXT[] DEFAULT '{}',
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      await sql.unsafe(`INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`);
      await sql.unsafe(`
        ALTER TABLE site_settings
          ADD COLUMN IF NOT EXISTS stats_title TEXT DEFAULT 'Números que respaldan nuestra trayectoria.',
          ADD COLUMN IF NOT EXISTS stats_quote TEXT DEFAULT 'Invertir en desarrollos es la forma más inteligente de multiplicar tu capital en el mercado inmobiliario.',
          ADD COLUMN IF NOT EXISTS stats_item_1_value VARCHAR(50) DEFAULT '25',
          ADD COLUMN IF NOT EXISTS stats_item_1_suffix VARCHAR(20) DEFAULT '+',
          ADD COLUMN IF NOT EXISTS stats_item_1_label VARCHAR(255) DEFAULT 'Años de experiencia',
          ADD COLUMN IF NOT EXISTS stats_item_1_description TEXT DEFAULT 'Más de dos décadas operando en el mercado inmobiliario de Buenos Aires.',
          ADD COLUMN IF NOT EXISTS stats_item_2_value VARCHAR(50) DEFAULT '500',
          ADD COLUMN IF NOT EXISTS stats_item_2_suffix VARCHAR(20) DEFAULT '+',
          ADD COLUMN IF NOT EXISTS stats_item_2_label VARCHAR(255) DEFAULT 'Unidades vendidas',
          ADD COLUMN IF NOT EXISTS stats_item_2_description TEXT DEFAULT 'Propiedades comercializadas entre desarrollos, departamentos y casas.',
          ADD COLUMN IF NOT EXISTS stats_item_3_value VARCHAR(50) DEFAULT '40',
          ADD COLUMN IF NOT EXISTS stats_item_3_suffix VARCHAR(20) DEFAULT '%',
          ADD COLUMN IF NOT EXISTS stats_item_3_label VARCHAR(255) DEFAULT 'Retorno promedio',
          ADD COLUMN IF NOT EXISTS stats_item_3_description TEXT DEFAULT 'Ganancia típica al revender una unidad comprada en pozo.',
          ADD COLUMN IF NOT EXISTS stats_item_4_value VARCHAR(50) DEFAULT '12',
          ADD COLUMN IF NOT EXISTS stats_item_4_suffix VARCHAR(20) DEFAULT '',
          ADD COLUMN IF NOT EXISTS stats_item_4_label VARCHAR(255) DEFAULT 'Desarrollos activos',
          ADD COLUMN IF NOT EXISTS stats_item_4_description TEXT DEFAULT 'Proyectos en construcción o pre-venta disponibles para inversores.',
          ADD COLUMN IF NOT EXISTS about_video TEXT DEFAULT '',
          ADD COLUMN IF NOT EXISTS investment_video TEXT DEFAULT ''
      `);
      results.push("Tabla site_settings y estadísticas OK");

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
      results.push("Usuario admin OK");

      // Politicas de Storage
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

      try {
        await sql.unsafe(`
          CREATE POLICY "properties_public_select"
          ON storage.objects FOR SELECT
          TO public
          USING (bucket_id = 'properties');
        `);
        results.push("Politica SELECT OK");
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
        results.push("Politica INSERT OK");
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
        results.push("Politica UPDATE OK");
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
        results.push("Politica DELETE OK");
      } catch (e: any) {
        results.push(`Error politica DELETE: ${e.message}`);
      }

      try {
        await sql.unsafe(`NOTIFY pgrst, 'reload schema';`);
        results.push("Schema cache refresh enviado");
      } catch {}

      // Migrations: add new columns if they don't exist
      try {
        await sql.unsafe(`ALTER TABLE developments ADD COLUMN IF NOT EXISTS brochure_url TEXT;`);
        results.push("Columna brochure_url en developments OK");
      } catch (e: any) {
        results.push(`Error columna brochure_url: ${e.message}`);
      }

      try {
        await sql.unsafe(`ALTER TABLE developments ADD COLUMN IF NOT EXISTS price_list_url TEXT;`);
        results.push("Columna price_list_url en developments OK");
      } catch (e: any) {
        results.push(`Error columna price_list_url: ${e.message}`);
      }

      try {
        await sql.unsafe(`ALTER TABLE developments ADD COLUMN IF NOT EXISTS video_url TEXT;`);
        await sql.unsafe(`ALTER TABLE developments ADD COLUMN IF NOT EXISTS video_urls TEXT[] DEFAULT '{}';`);
        await sql.unsafe(`ALTER TABLE developments ADD COLUMN IF NOT EXISTS video_is_primary BOOLEAN DEFAULT false;`);
        await sql.unsafe(`NOTIFY pgrst, 'reload schema';`);
        results.push("Columnas de video en developments OK");
      } catch (e: any) {
        results.push(`Error columna video_url: ${e.message}`);
      }

      try {
        await sql.unsafe(`ALTER TABLE developments ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public';`);
        await sql.unsafe(`UPDATE developments SET visibility = 'public' WHERE visibility IS NULL;`);
        await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_developments_visibility ON developments(visibility);`);
        results.push("Columna visibility en developments OK");
      } catch (e: any) {
        results.push(`Error columna visibility en developments: ${e.message}`);
      }

      try {
        await sql.unsafe(`ALTER TABLE units ADD COLUMN IF NOT EXISTS down_payment DECIMAL(12,2);`);
        results.push("Columna down_payment en units OK");
      } catch (e: any) {
        results.push(`Error columna down_payment en units: ${e.message}`);
      }

      try {
        await sql.unsafe(`ALTER TABLE units ADD COLUMN IF NOT EXISTS installment_count INTEGER;`);
        results.push("Columna installment_count en units OK");
      } catch (e: any) {
        results.push(`Error columna installment_count en units: ${e.message}`);
      }

      try {
        await sql.unsafe(`ALTER TABLE units ADD COLUMN IF NOT EXISTS installment_value DECIMAL(12,2);`);
        results.push("Columna installment_value en units OK");
      } catch (e: any) {
        results.push(`Error columna installment_value en units: ${e.message}`);
      }

      try {
        await sql.unsafe(`ALTER TABLE units ADD COLUMN IF NOT EXISTS video_url TEXT;`);
        await sql.unsafe(`NOTIFY pgrst, 'reload schema';`);
        results.push("Columna video_url en units OK");
      } catch (e: any) {
        results.push(`Error columna video_url en units: ${e.message}`);
      }

      try {
        await sql.unsafe(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS title VARCHAR(255);`);
        results.push("Columna title en agents OK");
      } catch (e: any) {
        results.push(`Error columna title en agents: ${e.message}`);
      }

      try {
        await sql.unsafe(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;`);
        await sql.unsafe(`
          WITH ordered_agents AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY COALESCE(sort_order, 999999), created_at ASC) - 1 AS rn
            FROM agents
          )
          UPDATE agents
          SET sort_order = ordered_agents.rn
          FROM ordered_agents
          WHERE agents.id = ordered_agents.id
        `);
        await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_agents_sort_order ON agents(sort_order);`);
        results.push("Columna sort_order en agents OK");
      } catch (e: any) {
        results.push(`Error columna sort_order en agents: ${e.message}`);
      }

      // Promote pablo@barrerabrokers.com to admin if exists
      try {
        const updated = await sql`
          UPDATE agents
          SET role = 'admin', active = true
          WHERE email = 'pablo@barrerabrokers.com'
          RETURNING id, email
        `;
        if (updated.length > 0) {
          results.push(`pablo@barrerabrokers.com promovido a admin`);
        } else {
          results.push(`pablo@barrerabrokers.com no existe (registralo primero)`);
        }
      } catch (e: any) {
        results.push(`Error promoviendo a pablo: ${e.message}`);
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
    results.push("ERROR: No se encontro variable de conexion");
  }

  // Storage bucket
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
          allowedMimeTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/jpg",
            "video/mp4",
            "video/quicktime",
            "video/webm",
            "video/x-m4v",
            "application/pdf",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ],
          fileSizeLimit: 52428800,
        });
        if (updateError) {
          results.push(`Error actualizando bucket: ${updateError.message}`);
        } else {
          results.push("Bucket 'properties' OK (publico)");
        }
      } else {
        const { error: bucketError } = await supabase.storage.createBucket("properties", {
          public: true,
          allowedMimeTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/jpg",
            "video/mp4",
            "video/quicktime",
            "video/webm",
            "video/x-m4v",
            "application/pdf",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ],
          fileSizeLimit: 52428800,
        });

        if (bucketError) {
          results.push(`Error creando bucket: ${bucketError.message}`);
        } else {
          results.push("Bucket 'properties' creado");
        }
      }
    }
  } catch (error: any) {
    results.push(`Error storage: ${error.message}`);
  }

  return NextResponse.json({
    success: true,
    message: reset ? "Inicializacion con RESET completada" : "Inicializacion completada",
    reset,
    hint: reset ? null : "Si las columnas faltan, llama con ?reset=true para recrear las tablas",
    results,
    adminCredentials: {
      email: "admin@barrerabrokers.com",
      password: "admin123",
    },
  });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
