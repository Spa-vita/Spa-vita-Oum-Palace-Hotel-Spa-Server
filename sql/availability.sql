-- Exécuter dans psql / SQL Editor
-- Unités physiques + blocs d'indisponibilité (admin availability)

create table if not exists public.room_units (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  type text not null,              -- catalog room type slug (matches /admin/rooms ids)
  floor int,
  status text not null default 'available',  -- available | occupied | cleaning | maintenance
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  room_type text,                  -- null = all types
  rooms_count int,                 -- null = all of that type
  reason text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_blocks_dates
  on public.availability_blocks (start_date, end_date);
