alter table public.mia_clients
  add column if not exists opciones_enviadas boolean not null default false,
  add column if not exists opciones_proyecto text,
  add column if not exists opciones_fecha timestamptz;
alter table public.mia_conversations
  add column if not exists opciones_enviadas boolean not null default false,
  add column if not exists opciones_proyecto text,
  add column if not exists opciones_fecha timestamptz;
