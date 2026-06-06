-- Exécuter dans Supabase : SQL Editor → New query → Run
-- Table des réservations (site public + dashboard admin)

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  status text not null default 'pending',
  type text not null default 'rooms',
  created_at timestamptz not null default now(),
  source text,
  locale text,
  summary jsonb not null,
  guest jsonb not null
);

-- Si la table existait déjà (ancienne version sans "type"), ajouter la colonne
alter table public.reservations
  add column if not exists type text not null default 'rooms';

create index if not exists idx_reservations_created_at
  on public.reservations (created_at desc);

create index if not exists idx_reservations_status
  on public.reservations (status);

create index if not exists idx_reservations_type
  on public.reservations (type);

-- RLS : le serveur Nest utilise service_role (bypass RLS).
-- Sans policies pour anon/authenticated → refus par défaut.
alter table public.reservations enable row level security;
