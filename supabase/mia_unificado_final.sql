-- MIA - Esquema unificado final - SEGURO, no borra datos
-- Ejecutar en el proyecto existente de web-bbrokers

create table if not exists public.mia_config (
  id uuid primary key default gen_random_uuid(),
  clave text unique,
  valor text,
  actualizado_en timestamptz default now()
);

create table if not exists public.mia_clients (
  id uuid primary key default gen_random_uuid(),
  whatsapp text unique,
  nombre text,
  resumen text,
  preferencias jsonb default '{}'::jsonb,
  presupuesto text,
  zona text,
  destino text,
  entrega_deseada text,
  boton_caliente text,
  estado text default 'nuevo',
  proximo_paso text,
  ultima_interaccion timestamptz,
  creado_en timestamptz default now()
);

create table if not exists public.mia_conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.mia_clients(id),
  whatsapp text,
  estado text default 'en_conversacion',
  resumen text,
  ultimo_mensaje text,
  creado_en timestamptz default now()
);

create table if not exists public.mia_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.mia_conversations(id),
  client_id uuid references public.mia_clients(id),
  rol text,
  texto text,
  provider_message_id text unique,
  conocimiento_version_usada int,
  creado_en timestamptz default now()
);

create table if not exists public.mia_knowledge (
  id uuid primary key default gen_random_uuid(),
  tipo text,
  slug text,
  titulo text,
  contenido text,
  ejemplo_bueno text,
  ejemplo_malo text,
  fuente_tipo text,
  fuente_nombre text,
  categoria text,
  situacion text,
  version int default 1,
  estado text default 'borrador',
  creado_en timestamptz default now()
);

create table if not exists public.mia_learnings (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  titulo text,
  regla text,
  ejemplo_bueno text,
  ejemplo_malo text,
  aprobada boolean default false,
  version int default 1,
  creado_en timestamptz default now()
);

create table if not exists public.mia_observations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid,
  tipo text,
  propuesta text,
  estado text default 'pendiente',
  creado_en timestamptz default now()
);

create table if not exists public.mia_meetings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.mia_clients(id),
  conversation_id uuid references public.mia_conversations(id),
  agente text,
  fecha date,
  hora_inicio time,
  hora_fin time,
  modalidad text,
  lugar_link text,
  estado text default 'pendiente',
  google_event_id text,
  creado_en timestamptz default now()
);

create table if not exists public.mia_reminders (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.mia_meetings(id),
  tipo text,
  canal text,
  estado text default 'pendiente',
  enviado_en timestamptz,
  creado_en timestamptz default now()
);

-- Verificacion, ejecutar despues:
-- select count(*) as total_publicado from public.mia_knowledge where estado = 'publicado';
-- Debe dar 13: 11 estrategias + 2 templates
-- select count(*) as estrategias from public.mia_knowledge where estado = 'publicado' and fuente_nombre like '%Brian Tracy%';
-- Debe dar 11
-- select to_regclass('public.mia_reminders');
-- Debe dar public.mia_reminders, no null
