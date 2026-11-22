-- Adviento Express · ligas de amigos
-- Una liga es un código de 6 caracteres que se comparte por enlace (?liga=abc123).
-- Los miembros son dispositivos (su hash). La clasificación de la liga es una vista que
-- une runs y miembros por el hash sin exponerlo. Escribe solo la Edge Function submit-run.

create table if not exists public.league_members (
  league      text        not null check (league ~ '^[a-z0-9]{6}$'),
  device_hash text        not null,
  joined_at   timestamptz not null default now(),
  primary key (league, device_hash)
);

alter table public.league_members enable row level security;
revoke all on public.league_members from anon, authenticated;

-- La vista corre con los permisos de su dueño (security_invoker = false): puede leer
-- device_hash para hacer el join, pero no lo devuelve.
create or replace view public.league_board with (security_invoker = false) as
  select m.league, r.season, r.day, r.id, r.name, r.total_ms
  from public.runs r
  join public.league_members m on m.device_hash = r.device_hash;

revoke all on public.league_board from anon, authenticated;
grant select on public.league_board to anon, authenticated;
