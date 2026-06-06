-- Migration uniquement : table reservations déjà créée sans colonne "type"
-- Exécuter dans Supabase SQL Editor si vous avez l'erreur : column "type" does not exist

alter table public.reservations
  add column if not exists type text not null default 'rooms';

create index if not exists idx_reservations_type
  on public.reservations (type);
