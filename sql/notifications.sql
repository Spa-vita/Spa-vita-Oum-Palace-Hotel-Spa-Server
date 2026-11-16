-- Exécuter dans psql / SQL Editor
-- Notifications admin (ex. nouvelle réservation)

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'booking',   -- 'booking' | 'review' | 'system'
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_created
  on public.notifications (created_at desc);
