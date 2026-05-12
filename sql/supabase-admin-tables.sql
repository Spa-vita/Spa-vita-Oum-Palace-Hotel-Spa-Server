-- Exécuter dans Supabase : SQL Editor → New query → Run
-- جداول مصادقة الأدمن للـ API (PostgREST)

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.admin_users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null
);

create index if not exists idx_admin_refresh_tokens_hash
  on public.admin_refresh_tokens (token_hash);

-- Exposer les tables au Data API (si vous utilisez le schéma public, souvent déjà exposé)
-- Vérifier : Project Settings → Data API → schémas exposés

-- RLS : avec SUPABASE_SERVICE_ROLE_KEY sur le serveur, RLS est contourné.
-- Avec la clé publishable/anon uniquement, il faut des politiques explicites (non recommandé pour admin_users).

alter table public.admin_users enable row level security;
alter table public.admin_refresh_tokens enable row level security;

-- Aucune politique pour anon/authenticated = refus par défaut.
-- Le backend Nest avec service_role accède quand même (bypass RLS).
