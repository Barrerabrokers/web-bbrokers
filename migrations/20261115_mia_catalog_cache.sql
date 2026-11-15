create table if not exists public.mia_catalog_cache (
  proyecto text not null,
  registro text not null,
  moneda text not null default 'USD',
  datos jsonb not null,
  actualizado_en timestamptz not null default now(),
  primary key (proyecto, registro)
);
alter table public.mia_catalog_cache enable row level security;
