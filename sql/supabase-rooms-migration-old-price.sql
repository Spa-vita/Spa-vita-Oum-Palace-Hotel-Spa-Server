-- Migration : anciens prix (barrés) pour le CMS chambres
-- Exécuter dans Supabase SQL Editor si la table `rooms` existe déjà.

alter table public.rooms
  add column if not exists show_old_price boolean not null default false;

alter table public.rooms
  add column if not exists old_price_amount integer
    check (old_price_amount is null or old_price_amount >= 0);

alter table public.rooms
  add column if not exists old_price_currency text
    check (old_price_currency is null or old_price_currency = 'MAD');
