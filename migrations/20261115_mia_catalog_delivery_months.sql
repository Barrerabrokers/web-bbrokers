alter table public.mia_catalog_cache add column if not exists entrega_meses integer;

update public.mia_catalog_cache
set entrega_meses = substring(datos #>> '{project,delivery}' from '^[0-9]{1,4}')::integer
where entrega_meses is null
  and datos #>> '{project,delivery}' ~ '^[0-9]{1,4} meses$';
