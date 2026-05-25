-- ====================================================================
-- BARRERA BROKERS - Schema de Desarrollos y Unidades
-- ====================================================================
-- Ejecuta este SQL en el SQL Editor de Supabase:
-- https://supabase.com/dashboard/project/_/sql
--
-- IMPORTANTE: Ejecutar DESPUES de supabase-schema.sql
-- ====================================================================

-- ====================================================================
-- TABLA: developments (Desarrollos inmobiliarios)
-- ====================================================================
CREATE TABLE IF NOT EXISTS developments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  short_description VARCHAR(500),
  description TEXT NOT NULL,
  location VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  status VARCHAR(30) DEFAULT 'pre_venta' CHECK (status IN ('pre_venta', 'en_construccion', 'finalizado', 'entregado')),
  total_units INTEGER DEFAULT 0,
  completion_date VARCHAR(50),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  price_from DECIMAL(12,2),
  currency VARCHAR(3) DEFAULT 'USD',
  amenities TEXT[] DEFAULT '{}',
  features TEXT[] DEFAULT '{}',
  highlight BOOLEAN DEFAULT false,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_developments_slug ON developments(slug);
CREATE INDEX IF NOT EXISTS idx_developments_status ON developments(status);
CREATE INDEX IF NOT EXISTS idx_developments_highlight ON developments(highlight);


-- ====================================================================
-- TABLA: development_images (Imagenes del desarrollo)
-- ====================================================================
-- type: fachada | espacios_comunes | render | amenities | otro
CREATE TABLE IF NOT EXISTS development_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  development_id UUID REFERENCES developments(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  storage_path TEXT,
  type VARCHAR(30) DEFAULT 'otro',
  caption VARCHAR(255),
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_images_development ON development_images(development_id);

-- ====================================================================
-- TABLA: units (Unidades de cada desarrollo)
-- ====================================================================
CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  development_id UUID REFERENCES developments(id) ON DELETE CASCADE,
  unit_number VARCHAR(50) NOT NULL,
  floor VARCHAR(50),
  bedrooms INTEGER NOT NULL DEFAULT 1,
  bathrooms INTEGER NOT NULL DEFAULT 1,
  area DECIMAL(10,2) NOT NULL,
  balcony_area DECIMAL(10,2),
  total_area DECIMAL(10,2),
  price DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  expenses DECIMAL(10,2),
  orientation VARCHAR(50),
  status VARCHAR(20) DEFAULT 'disponible' CHECK (status IN ('disponible', 'reservada', 'vendida')),
  description TEXT,
  features TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_units_development ON units(development_id);
CREATE INDEX IF NOT EXISTS idx_units_status ON units(status);
CREATE INDEX IF NOT EXISTS idx_units_bedrooms ON units(bedrooms);


-- ====================================================================
-- TABLA: unit_images (Imagenes y planos de cada unidad)
-- ====================================================================
-- type: foto | plano | render | otro
CREATE TABLE IF NOT EXISTS unit_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  storage_path TEXT,
  type VARCHAR(30) DEFAULT 'foto',
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unit_images_unit ON unit_images(unit_id);

-- ====================================================================
-- TRIGGERS para updated_at
-- ====================================================================
DROP TRIGGER IF EXISTS update_developments_updated_at ON developments;
CREATE TRIGGER update_developments_updated_at
  BEFORE UPDATE ON developments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_units_updated_at ON units;
CREATE TRIGGER update_units_updated_at
  BEFORE UPDATE ON units
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- VIEW: development_with_stats
-- ====================================================================
-- Incluye conteo de unidades disponibles y precio minimo actualizado
CREATE OR REPLACE VIEW development_with_stats AS
SELECT
  d.*,
  COUNT(u.id) FILTER (WHERE u.status = 'disponible') AS available_units,
  COUNT(u.id) AS units_count,
  MIN(u.price) FILTER (WHERE u.status = 'disponible') AS min_price_available
FROM developments d
LEFT JOIN units u ON u.development_id = d.id
GROUP BY d.id;
