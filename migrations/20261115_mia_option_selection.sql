alter table public.mia_conversations
  add column if not exists opciones_detalle jsonb not null default '[]',
  add column if not exists opcion_elegida integer;
