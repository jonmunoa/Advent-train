-- Adviento Express · clasificación global
-- Una fila por temporada, día y dispositivo: su mejor tiempo y el fantasma de esa carrera.
-- Escribe solo la Edge Function submit-run (service_role). El público solo lee columnas
-- que no identifican el dispositivo.

create table if not exists public.runs (
  id          bigint generated always as identity primary key,
  season      smallint    not null,
  day         smallint    not null check (day between 1 and 24),
  name        text        not null check (char_length(name) between 1 and 16),
  total_ms    integer     not null check (total_ms > 0),
  raw_ms      integer     not null check (raw_ms > 0),
  bells       smallint    not null default 0,
  gifts_lost  smallint    not null default 0,
  turbos      smallint    not null default 0,
  ghost       text        not null check (char_length(ghost) <= 4000),
  device_hash text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (season, day, device_hash)
);

create index if not exists runs_board on public.runs (season, day, total_ms);

alter table public.runs enable row level security;

-- Supabase da todos los permisos a anon/authenticated por defecto: se quitan y se
-- concede solo lectura de las columnas públicas (sin device_hash).
revoke all on public.runs from anon, authenticated;
grant select (id, season, day, name, total_ms, raw_ms, bells, gifts_lost, turbos, ghost, created_at)
  on public.runs to anon, authenticated;

drop policy if exists "runs: lectura pública" on public.runs;
create policy "runs: lectura pública" on public.runs
  for select to anon, authenticated using (true);

-- Sin políticas de insert/update/delete: con RLS activa, anon no puede escribir.
-- La Edge Function usa la service_role, que se salta RLS.
