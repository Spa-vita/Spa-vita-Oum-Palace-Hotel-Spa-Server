-- Exécuter dans psql / SQL Editor
-- Ledger paiements / remboursements (Finance)

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid,
  type text not null default 'payment',   -- payment | refund
  amount numeric not null,
  method text not null default 'cmi',      -- cmi | manual | cash | transfer
  created_at timestamptz not null default now()
);

create unique index if not exists uniq_payment_per_reservation
  on public.transactions (reservation_id)
  where type = 'payment';

create index if not exists idx_transactions_created
  on public.transactions (created_at desc);
