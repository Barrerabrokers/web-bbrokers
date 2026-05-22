import { NextResponse } from "next/server";

// Endpoint para inicializar la base de datos automaticamente
// Devuelve instrucciones claras sobre como crear las tablas
export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Variables de entorno no configuradas" },
      { status: 500 }
    );
  }

  // Extraer project ref de la URL
  const projectRef = supabaseUrl
    .replace("https://", "")
    .replace(".supabase.co", "");

  return NextResponse.json({
    message: "Para crear las tablas, ejecuta el SQL en Supabase",
    sqlEditorUrl: `https://supabase.com/dashboard/project/${projectRef}/sql/new`,
    sql: `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

CREATE TABLE IF NOT EXISTS property_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  storage_path TEXT,
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

INSERT INTO agents (name, email, password, role)
VALUES ('Admin Barrera', 'admin@barrerabrokers.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin')
ON CONFLICT (email) DO NOTHING;
`,
  });
}

export async function GET() {
  return POST();
}
