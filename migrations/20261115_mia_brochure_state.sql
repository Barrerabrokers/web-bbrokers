alter table public.mia_clients
  add column if not exists brochure_ofrecido boolean not null default false,
  add column if not exists brochure_enviado boolean not null default false,
  add column if not exists brochure_proyecto text,
  add column if not exists ultima_pregunta text;
alter table public.mia_conversations
  add column if not exists brochure_ofrecido boolean not null default false,
  add column if not exists brochure_enviado boolean not null default false,
  add column if not exists brochure_proyecto text,
  add column if not exists ultima_pregunta text;
