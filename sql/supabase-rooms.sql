-- Exécuter dans Supabase : SQL Editor → New query → Run
-- Table CMS admin des chambres (+ seed aligné sur le site public)

create table if not exists public.rooms (
  id text primary key,
  type_slug text not null,
  title jsonb not null,
  description jsonb not null,
  price_amount integer not null check (price_amount >= 0),
  price_currency text not null default 'MAD' check (price_currency = 'MAD'),
  show_old_price boolean not null default false,
  old_price_amount integer check (old_price_amount is null or old_price_amount >= 0),
  old_price_currency text check (old_price_currency is null or old_price_currency = 'MAD'),
  image jsonb,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Si la table existait déjà sans ces colonnes
alter table public.rooms
  add column if not exists show_old_price boolean not null default false;
alter table public.rooms
  add column if not exists old_price_amount integer
    check (old_price_amount is null or old_price_amount >= 0);
alter table public.rooms
  add column if not exists old_price_currency text
    check (old_price_currency is null or old_price_currency = 'MAD');


create index if not exists idx_rooms_type_slug on public.rooms (type_slug);
create index if not exists idx_rooms_is_active on public.rooms (is_active);

-- RLS : le serveur Nest utilise service_role (bypass RLS).
alter table public.rooms enable row level security;

-- Seed initial (idempotent) — IDs alignés sur le listing public / réservations
insert into public.rooms (
  id, type_slug, title, description, price_amount, price_currency, image, is_active, updated_at
) values
  (
    'single-deluxe',
    'single-deluxe',
    '{"fr":"Chambre single deluxe","en":"Single deluxe room"}'::jsonb,
    '{"fr":"Chambre single deluxe de 13 m² : trois lits une place, pour jusqu’à trois adultes. Agencement compact avec tout le confort hôtelier pour un séjour pratique à Casablanca.","en":"Single deluxe room (13 m²): three single beds for up to three adults. A compact layout with full hotel comfort for a practical stay in Casablanca."}'::jsonb,
    800,
    'MAD',
    '{"id":"img_/images/rooms/chembre-single/DSCF0294.jpg","url":"/images/rooms/chembre-single/DSCF0294.jpg","alt":"Single deluxe"}'::jsonb,
    true,
    now()
  ),
  (
    'executive-suite',
    'executive-suite',
    '{"fr":"Suite executive","en":"Executive suite"}'::jsonb,
    '{"fr":"Suite executive : salon et chambre distincts, lit king, calme pour téléphoner ou s’installer. Étages élevés ; certains agencements proposent une terrasse privée.","en":"Executive suite: distinct lounge and bedroom, king bed, quiet space for calls or unpacking. Upper floors; some layouts include a private terrace."}'::jsonb,
    1800,
    'MAD',
    '{"id":"img_/images/rooms/suite-executive/DSCF0328.jpg","url":"/images/rooms/suite-executive/DSCF0328.jpg","alt":"Executive suite"}'::jsonb,
    true,
    now()
  ),
  (
    'executive-terrace',
    'executive-suite',
    '{"fr":"Suite executive — terrasse","en":"Executive suite — terrace"}'::jsonb,
    '{"fr":"Suite executive avec terrasse privée — salon et chambre séparés, petit-déjeuner inclus.","en":"Executive suite with private terrace — separate lounge and bedroom, breakfast included."}'::jsonb,
    1800,
    'MAD',
    '{"id":"img_/images/rooms/suite-executive/DSCF0539.jpg","url":"/images/rooms/suite-executive/DSCF0539.jpg","alt":"Executive terrace"}'::jsonb,
    true,
    now()
  ),
  (
    'deluxe',
    'deluxe',
    '{"fr":"Chambre triple deluxe","en":"Triple deluxe room"}'::jsonb,
    '{"fr":"Configuration triple deluxe avec couchages multiples, salle de bain confortable, plateau courtoisie et Wi‑Fi — parfait lorsque vous voyagez à trois ou souhaitez un vrai espace de vie.","en":"Triple deluxe configuration with multiple beds, a comfortable bathroom, courtesy tray and Wi‑Fi — perfect when you are three, or simply want more room to settle in."}'::jsonb,
    1400,
    'MAD',
    '{"id":"img_/images/rooms/chambres-triple-deluxe/DSC09898.jpg","url":"/images/rooms/chambres-triple-deluxe/DSC09898.jpg","alt":"Triple deluxe"}'::jsonb,
    true,
    now()
  ),
  (
    'deluxe-prestige',
    'premium',
    '{"fr":"Chambre triple deluxe — Prestige","en":"Triple deluxe room — Prestige"}'::jsonb,
    '{"fr":"Une seconde proposition triple deluxe au standing supérieur : volumes, matériaux et confort pensés pour un séjour plus exclusif avant de passer aux suites.","en":"A second triple-deluxe offer with a higher level of finish and comfort — for guests who want an extra step up before moving to a full suite."}'::jsonb,
    1400,
    'MAD',
    '{"id":"img_/images/rooms/chambres-triple-deluxe/DSCF3120.jpg","url":"/images/rooms/chambres-triple-deluxe/DSCF3120.jpg","alt":"Deluxe Prestige"}'::jsonb,
    true,
    now()
  ),
  (
    'superior',
    'superior',
    '{"fr":"Chambre double supérieure","en":"Superior double room"}'::jsonb,
    '{"fr":"Notre chambre double supérieure — agencement clair, literie double de qualité et tout l’équipement attendu pour affaires ou escapade à Casablanca.","en":"Our superior double room — clear layout, quality double bed and everything you need for business or a city break in Casablanca."}'::jsonb,
    1100,
    'MAD',
    '{"id":"img_/images/rooms/chambres-double-superieure/346890003.jpg","url":"/images/rooms/chambres-double-superieure/346890003.jpg","alt":"Superior double"}'::jsonb,
    true,
    now()
  ),
  (
    'superior-vue',
    'twin',
    '{"fr":"Chambre lits jumeaux supérieure","en":"Superior twin room"}'::jsonb,
    '{"fr":"Chambre lits jumeaux supérieure : deux couchages distincts, circulation aisée — idéale pour collègues, amis ou parents avec enfant selon configuration.","en":"Superior twin layout with two separate beds and easy circulation — well suited to colleagues, friends, or families depending on configuration."}'::jsonb,
    1100,
    'MAD',
    '{"id":"img_/images/rooms/chembre-lits-jumeaux-superieure/DSCF0184.jpg","url":"/images/rooms/chembre-lits-jumeaux-superieure/DSCF0184.jpg","alt":"Superior twin"}'::jsonb,
    true,
    now()
  ),
  (
    'presidential',
    'presidential',
    '{"fr":"Suite présidentielle","en":"Presidential suite"}'::jsonb,
    '{"fr":"Le sommet du luxe et de l’espace — suite présidentielle pour un séjour d’exception à Casablanca.","en":"The pinnacle of luxury and space — presidential suite for an exceptional stay in Casablanca."}'::jsonb,
    1800,
    'MAD',
    '{"id":"img_/images/rooms/suite-executive/DSCF0099.jpg","url":"/images/rooms/suite-executive/DSCF0099.jpg","alt":"Presidential suite"}'::jsonb,
    true,
    now()
  ),
  (
    'presidential-panoramic',
    'presidential',
    '{"fr":"Suite présidentielle — panoramique","en":"Presidential suite — panoramic"}'::jsonb,
    '{"fr":"Suite présidentielle panoramique — volumes généreux et vue ouverte pour un séjour d’exception.","en":"Panoramic presidential suite — generous volumes and open views for an exceptional stay."}'::jsonb,
    1800,
    'MAD',
    '{"id":"img_/images/rooms/suite-executive/DSCF0346.jpg","url":"/images/rooms/suite-executive/DSCF0346.jpg","alt":"Presidential panoramic"}'::jsonb,
    true,
    now()
  )
on conflict (id) do nothing;
