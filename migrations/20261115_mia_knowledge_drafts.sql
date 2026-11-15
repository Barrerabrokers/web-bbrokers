alter table public.mia_knowledge add column if not exists borrador text;
alter table public.mia_learnings add column if not exists aprobada boolean default false;
alter table public.mia_learnings add column if not exists regla text;
