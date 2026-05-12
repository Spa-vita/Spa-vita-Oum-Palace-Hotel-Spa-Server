-- Exécuter dans Supabase : SQL Editor → New query → Run
-- جدول الحجوزات للواجهة + لوحة الأدمن

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  source text,
  locale text,
  summary jsonb not null,
  guest jsonb not null
);

create index if not exists idx_reservations_created_at
  on public.reservations (created_at desc);

create index if not exists idx_reservations_status
  on public.reservations (status);

-- RLS (اختياري): بما أن السيرفر يستعمل service_role فهو يتجاوز RLS.
-- نفعّلها كحماية إضافية ومن دون policies للـ anon/authenticated (رفض افتراضي).
alter table public.reservations enable row level security;

