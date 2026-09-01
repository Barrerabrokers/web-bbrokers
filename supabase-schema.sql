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
  title VARCHAR(255),
  role VARCHAR(20) DEFAULT 'agent' CHECK (role IN ('agent', 'admin', 'marketing')),
  active BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_email ON agents(email);
CREATE INDEX IF NOT EXISTS idx_agents_role ON agents(role);
CREATE INDEX IF NOT EXISTS idx_agents_sort_order ON agents(sort_order);

-- ====================================================================
-- TABLA: agent_password_reset_tokens (Recuperación de contraseñas)
-- ====================================================================
CREATE TABLE IF NOT EXISTS agent_password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  approve_on_use BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_password_reset_tokens
  ADD COLUMN IF NOT EXISTS approve_on_use BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_agent_password_reset_tokens_token_hash
  ON agent_password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_agent_password_reset_tokens_agent_id
  ON agent_password_reset_tokens(agent_id);

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
  visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'agents')),
  video_urls TEXT[] DEFAULT '{}',
  video_is_primary BOOLEAN DEFAULT false,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_category ON properties(category);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_visibility ON properties(visibility);
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

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

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
  hero_videos TEXT[] DEFAULT '{}',
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
  ADD COLUMN IF NOT EXISTS about_video TEXT
    DEFAULT '',
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


-- ====================================================================
-- Extension de site_settings — Sección "Prensa"
-- ====================================================================
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS press_links TEXT DEFAULT '';


-- ====================================================================
-- Extension de site_settings — Sección "Estadísticas"
-- ====================================================================
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS stats_title TEXT
    DEFAULT 'Números que respaldan nuestra trayectoria.',
  ADD COLUMN IF NOT EXISTS stats_quote TEXT
    DEFAULT 'Invertir en desarrollos es la forma más inteligente de multiplicar tu capital en el mercado inmobiliario.',
  ADD COLUMN IF NOT EXISTS stats_item_1_value VARCHAR(50)
    DEFAULT '25',
  ADD COLUMN IF NOT EXISTS stats_item_1_suffix VARCHAR(20)
    DEFAULT '+',
  ADD COLUMN IF NOT EXISTS stats_item_1_label VARCHAR(255)
    DEFAULT 'Años de experiencia',
  ADD COLUMN IF NOT EXISTS stats_item_1_description TEXT
    DEFAULT 'Más de dos décadas operando en el mercado inmobiliario de Buenos Aires.',
  ADD COLUMN IF NOT EXISTS stats_item_2_value VARCHAR(50)
    DEFAULT '500',
  ADD COLUMN IF NOT EXISTS stats_item_2_suffix VARCHAR(20)
    DEFAULT '+',
  ADD COLUMN IF NOT EXISTS stats_item_2_label VARCHAR(255)
    DEFAULT 'Unidades vendidas',
  ADD COLUMN IF NOT EXISTS stats_item_2_description TEXT
    DEFAULT 'Propiedades comercializadas entre desarrollos, departamentos y casas.',
  ADD COLUMN IF NOT EXISTS stats_item_3_value VARCHAR(50)
    DEFAULT '40',
  ADD COLUMN IF NOT EXISTS stats_item_3_suffix VARCHAR(20)
    DEFAULT '%',
  ADD COLUMN IF NOT EXISTS stats_item_3_label VARCHAR(255)
    DEFAULT 'Retorno promedio',
  ADD COLUMN IF NOT EXISTS stats_item_3_description TEXT
    DEFAULT 'Ganancia típica al revender una unidad comprada en pozo.',
  ADD COLUMN IF NOT EXISTS stats_item_4_value VARCHAR(50)
    DEFAULT '12',
  ADD COLUMN IF NOT EXISTS stats_item_4_suffix VARCHAR(20)
    DEFAULT '',
  ADD COLUMN IF NOT EXISTS stats_item_4_label VARCHAR(255)
    DEFAULT 'Desarrollos activos',
  ADD COLUMN IF NOT EXISTS stats_item_4_description TEXT
    DEFAULT 'Proyectos en construcción o pre-venta disponibles para inversores.';



-- ====================================================================
-- Extension de site_settings — Sección "Inversión" (modelo de inversión)
-- ====================================================================
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS investment_image TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS investment_video TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS investment_eyebrow VARCHAR(100)
    DEFAULT 'Modelo de inversión',
  ADD COLUMN IF NOT EXISTS investment_title VARCHAR(255)
    DEFAULT 'Cómo funciona la inversión en desarrollos.',
  ADD COLUMN IF NOT EXISTS investment_description TEXT
    DEFAULT 'Un proceso simple y transparente. Desde el anticipo hasta la renta o reventa, te acompañamos en cada paso.',

  ADD COLUMN IF NOT EXISTS investment_step_1_title VARCHAR(255)
    DEFAULT 'Ingresá con el 35%',
  ADD COLUMN IF NOT EXISTS investment_step_1_highlight VARCHAR(100)
    DEFAULT 'Anticipo inicial',
  ADD COLUMN IF NOT EXISTS investment_step_1_value VARCHAR(50)
    DEFAULT '35%',
  ADD COLUMN IF NOT EXISTS investment_step_1_description TEXT
    DEFAULT 'Reservá tu unidad con un anticipo inicial del 35% del valor. Asegurás precio de pozo y comenzás a capitalizar desde el día uno.',

  ADD COLUMN IF NOT EXISTS investment_step_2_title VARCHAR(255)
    DEFAULT 'Financiá el saldo',
  ADD COLUMN IF NOT EXISTS investment_step_2_highlight VARCHAR(100)
    DEFAULT 'Saldo en cuotas',
  ADD COLUMN IF NOT EXISTS investment_step_2_value VARCHAR(50)
    DEFAULT '65%',
  ADD COLUMN IF NOT EXISTS investment_step_2_description TEXT
    DEFAULT 'El 65% restante lo pagás en cuotas durante la construcción. Planes flexibles adaptados a tu capacidad de ahorro.',

  ADD COLUMN IF NOT EXISTS investment_step_3_title VARCHAR(255)
    DEFAULT 'Revendé con ganancia',
  ADD COLUMN IF NOT EXISTS investment_step_3_highlight VARCHAR(100)
    DEFAULT 'Retorno estimado',
  ADD COLUMN IF NOT EXISTS investment_step_3_value VARCHAR(50)
    DEFAULT '30-40%',
  ADD COLUMN IF NOT EXISTS investment_step_3_description TEXT
    DEFAULT 'Una vez finalizado el proyecto, vendé tu unidad en el mercado. La diferencia entre precio de pozo y valor terminado genera retornos del 30-40%.',

  ADD COLUMN IF NOT EXISTS investment_step_4_title VARCHAR(255)
    DEFAULT 'O generá renta pasiva',
  ADD COLUMN IF NOT EXISTS investment_step_4_highlight VARCHAR(100)
    DEFAULT 'Renta mensual',
  ADD COLUMN IF NOT EXISTS investment_step_4_value VARCHAR(50)
    DEFAULT '24/7',
  ADD COLUMN IF NOT EXISTS investment_step_4_description TEXT
    DEFAULT 'Si preferís mantener la propiedad, nosotros la administramos como alquiler temporario tipo Airbnb. Vos cobrás, nosotros nos encargamos de todo.',

  ADD COLUMN IF NOT EXISTS investment_benefit_1 VARCHAR(255) DEFAULT 'Precio de pozo garantizado',
  ADD COLUMN IF NOT EXISTS investment_benefit_2 VARCHAR(255) DEFAULT 'Asesoramiento legal incluido',
  ADD COLUMN IF NOT EXISTS investment_benefit_3 VARCHAR(255) DEFAULT 'Seguimiento de obra en tiempo real',
  ADD COLUMN IF NOT EXISTS investment_benefit_4 VARCHAR(255) DEFAULT 'Sin comisiones ocultas',
  ADD COLUMN IF NOT EXISTS investment_benefit_5 VARCHAR(255) DEFAULT 'Gestión de reventa o alquiler',
  ADD COLUMN IF NOT EXISTS investment_benefit_6 VARCHAR(255) DEFAULT 'Soporte post-entrega',

  ADD COLUMN IF NOT EXISTS investment_benefits_title VARCHAR(255)
    DEFAULT 'Todo lo que incluye invertir con nosotros.',

  ADD COLUMN IF NOT EXISTS investment_cta_eyebrow VARCHAR(100)
    DEFAULT 'Comenzá ahora',
  ADD COLUMN IF NOT EXISTS investment_cta_title VARCHAR(255)
    DEFAULT '¿Querés saber más sobre oportunidades de inversión?',
  ADD COLUMN IF NOT EXISTS investment_cta_description TEXT
    DEFAULT 'Agendá una llamada con nuestro equipo. Te explicamos las opciones disponibles, los planes de financiación y respondemos todas tus consultas.';
