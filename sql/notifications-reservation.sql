-- Lier une notification booking à sa réservation (admin → détail)
alter table public.notifications
  add column if not exists reservation_id uuid;
