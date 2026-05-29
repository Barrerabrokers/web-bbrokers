-- ====================================================================
-- BARRERA BROKERS - Schema de Base de Datos para Supabase
-- ====================================================================
-- Ejecuta este SQL en el SQL Editor de Supabase:
-- https://supabase.com/dashboard/project/_/sql
-- ====================================================================

-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- TABLA: agents (Agentes y Administradores)
-- ====================================================================
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  photo TEXT,
  role VARCHAR(20) DEFAULT 'agent' CHECK (role IN ('agent', 'admin')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_email ON agents(email);
CREATE INDEX IF NOT EXISTS idx_agents_role ON agents(role);

-- ====================================================================
-- TABLA: properties (Propiedades)
-- ====================================================================
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('desarrollo', 'pozo', 'usados', 'rentals', 'inversiones', 'oportunidades')),
  price DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  location VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  bedrooms INTEGER,
  bathrooms INTEGER,
  area DECIMAL(10,2) NOT NULL,
  features TEXT[] DEFAULT '{}',
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'disponible' CHECK (status IN ('disponible', 'reservada', 'vendida')),
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_category ON properties(category);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_agent ON properties(agent_id);

-- ====================================================================
-- TABLA: property_images (Imágenes de propiedades)
-- ====================================================================
CREATE TABLE IF NOT EXISTS property_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  storage_path TEXT,
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_images_property ON property_images(property_id);

-- ====================================================================
-- TABLA: contacts (Mensajes de contacto)
-- ====================================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  message TEXT NOT NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'nuevo' CHECK (status IN ('nuevo', 'contactado', 'archivado')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);

-- ====================================================================
-- TRIGGERS para updated_at automático
-- ====================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_agents_updated_at ON agents;
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_properties_updated_at ON properties;
CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- STORAGE BUCKET para imágenes de propiedades
-- ====================================================================
-- Crea el bucket "properties" desde el dashboard de Supabase Storage:
-- https://supabase.com/dashboard/project/_/storage/buckets
-- 
-- Configuración:
-- - Name: properties
-- - Public: YES (para que las imágenes sean accesibles públicamente)

-- Políticas para el bucket "properties":
-- (Ejecutar después de crear el bucket en el dashboard)

-- Permitir lectura pública
INSERT INTO storage.buckets (id, name, public)
VALUES ('properties', 'properties', true)
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- Crear primer usuario ADMIN (cambiar el password)
-- ====================================================================
-- Ejecuta este INSERT después para crear tu primer admin:
-- El password debe ser hasheado con bcrypt. Para "admin123" usa el hash:
-- $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

-- Nota: este hash es válido para "admin123" pero deberías cambiarlo.
-- Genera nuevos hashes con: https://bcrypt-generator.com/

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

-- ====================================================================
-- LISTO - Ejecutaste el schema correctamente
-- ====================================================================
-- Próximos pasos:
-- 1. Crear el bucket "properties" en Supabase Storage si no existe
-- 2. Configurar las variables de entorno en Vercel
-- 3. Hacer redeploy
-- ====================================================================



-- ====================================================================
-- TABLA: site_settings (Configuración global del sitio — singleton)
-- ====================================================================
-- Datos editables desde /admin/settings que se reflejan en
-- header, footer, contacto, botón WhatsApp, etc.
-- Patrón singleton: una sola row con id=1.
-- ====================================================================
CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  company_name VARCHAR(255) NOT NULL DEFAULT 'Barrera Brokers',
  email VARCHAR(255) NOT NULL DEFAULT 'info@barrerabrokers.com',
  phone VARCHAR(50) NOT NULL DEFAULT '+54 11 1234-5678',
  whatsapp VARCHAR(50) NOT NULL DEFAULT '541112345678',
  address_street VARCHAR(255) NOT NULL DEFAULT 'Av. Principal 123',
  address_city VARCHAR(255) NOT NULL DEFAULT 'Buenos Aires, Argentina',
  whatsapp_message TEXT NOT NULL DEFAULT 'Hola! Me interesa conocer más sobre los desarrollos de Barrera Brokers.',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar la única fila si no existe
INSERT INTO site_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS update_site_settings_updated_at ON site_settings;
CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



-- ====================================================================
-- Extension de site_settings — Sección "Nosotros"
-- ====================================================================
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS about_image TEXT
    DEFAULT 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=90',
  ADD COLUMN IF NOT EXISTS about_eyebrow VARCHAR(100)
    DEFAULT 'Nosotros',
  ADD COLUMN IF NOT EXISTS about_title VARCHAR(255)
    DEFAULT 'Una inmobiliaria independiente',
  ADD COLUMN IF NOT EXISTS about_description TEXT
    DEFAULT 'Nacimos en el año 2000 con la idea de ofrecer un servicio inmobiliario claro, profesional y centrado en cada cliente. Hoy, más de dos décadas después, seguimos con el mismo equipo y la misma forma de trabajar.',
  ADD COLUMN IF NOT EXISTS about_stat_number VARCHAR(50)
    DEFAULT '+500',
  ADD COLUMN IF NOT EXISTS about_stat_label VARCHAR(255)
    DEFAULT 'Operaciones realizadas',
  ADD COLUMN IF NOT EXISTS about_value_1_title VARCHAR(100)
    DEFAULT 'Trayectoria',
  ADD COLUMN IF NOT EXISTS about_value_1_description TEXT
    DEFAULT 'Más de 25 años operando en Buenos Aires, con conocimiento profundo de cada barrio y tipología de propiedad.',
  ADD COLUMN IF NOT EXISTS about_value_2_title VARCHAR(100)
    DEFAULT 'Equipo',
  ADD COLUMN IF NOT EXISTS about_value_2_description TEXT
    DEFAULT 'Profesionales matriculados, especialistas en venta, alquiler, desarrollos e inversiones, trabajando en coordinación.',
  ADD COLUMN IF NOT EXISTS about_value_3_title VARCHAR(100)
    DEFAULT 'Atención',
  ADD COLUMN IF NOT EXISTS about_value_3_description TEXT
    DEFAULT 'Cada cliente recibe asesoramiento personalizado, desde la primera visita hasta la firma de la escritura o el contrato.';
