alter table public.agents add column if not exists mia_recordatorios_solo_mail boolean default false;
alter table public.mia_meetings add column if not exists lugar_link text;
alter table public.mia_reminders
  add column if not exists programado_en timestamptz,
  add column if not exists intentos int not null default 0,
  add column if not exists entregas jsonb not null default '{}'::jsonb;

create unique index if not exists mia_reminders_meeting_type_key
  on public.mia_reminders (meeting_id, tipo);
alter table public.mia_reminders enable row level security;

create or replace function public.mia_enqueue_reminders()
returns trigger language plpgsql set search_path = public as $$
declare
  starts_at timestamptz;
begin
  if new.estado <> 'confirmada' or new.dia is null or new.hora is null then
    return new;
  end if;
  starts_at := (new.dia::text || ' ' || new.hora::text)::timestamp at time zone 'America/Argentina/Buenos_Aires';
  insert into public.mia_reminders (meeting_id, tipo, canal, programado_en)
  values (new.id, '1_dia_antes', 'whatsapp+mail', starts_at - interval '1 day'),
         (new.id, '1_hora_antes', 'whatsapp+mail', starts_at - interval '1 hour')
  on conflict (meeting_id, tipo) do nothing;
  return new;
end;
$$;

create or replace trigger mia_meeting_confirmed_reminders
after insert or update of estado, dia, hora on public.mia_meetings
for each row execute function public.mia_enqueue_reminders();
