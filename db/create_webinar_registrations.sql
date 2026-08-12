-- Kontakty z registrácie na /webinar — nahrádza Ecomail. Jeden riadok na
-- email (opätovná registrácia na nový termín prepíše slot_start_ms a
-- resetuje potvrdenie/pripomienky, ale NEobnoví unsubscribed_at, aby sa
-- odhlásený kontakt znova sám "prihlásil" cez formulár bez opt-inu).
-- email sa vždy ukladá/vyhľadáva už lowercased z appky (server.js), takže
-- bežný unique constraint na email stačí (žiadny funkčný index potrebný) —
-- to zároveň umožňuje upsert(..., { onConflict: 'email' }) zo Supabase JS.
create table if not exists webinar_registrations (
  id bigserial primary key,
  email text not null unique,
  name text,
  slot_start_ms bigint not null,
  confirm_token text not null unique,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  reminder_24h_sent_at timestamptz,
  reminder_soon_sent_at timestamptz,
  offer_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists webinar_registrations_slot_idx on webinar_registrations (slot_start_ms);
