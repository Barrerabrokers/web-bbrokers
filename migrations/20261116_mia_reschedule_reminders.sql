begin;

drop index if exists public.mia_reminders_meeting_type_key;
create unique index if not exists mia_reminders_meeting_type_active_key
  on public.mia_reminders (meeting_id, tipo) where estado <> 'cancelado';

create or replace function public.mia_enqueue_reminders()
returns trigger language plpgsql set search_path = public as $$
declare
  starts_at timestamptz;
begin
  if new.estado <> 'confirmada' or new.dia is null or new.hora is null then
    return new;
  end if;
  starts_at := (new.dia + new.hora) at time zone 'America/Argentina/Buenos_Aires';
  insert into public.mia_reminders (meeting_id, tipo, canal, programado_en)
  values (new.id, '1_dia_antes', 'whatsapp+mail', starts_at - interval '1 day'),
         (new.id, '1_hora_antes', 'whatsapp+mail', starts_at - interval '1 hour')
  on conflict (meeting_id, tipo) where estado <> 'cancelado' do nothing;
  return new;
end;
$$;

commit;
