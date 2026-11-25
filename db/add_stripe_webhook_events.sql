-- Idempotency tracking pre Stripe webhook (POST /api/stripe/webhook v hlavnej
-- appke). Stripe explicitne priznáva, že vie ten istý event doručiť viackrát
-- (retry pri pomalej odpovedi, výpadku siete a pod.). Bez tejto tabuľky by
-- opakované doručenie checkout.session.completed pre kúpu kurzu spôsobilo:
-- duplicitný uvítací email, duplicitné zaplatenie partnerskej provízie a
-- extra inkrement discount_code.used_count. Webhook handler teraz pri
-- KAŽDOM evente najprv skúsi vložiť jeho event.id sem -- ak už existuje
-- (conflict), event sa ignoruje ako už spracovaný.
--
-- Spusti v Supabase SQL editore (alebo cez psql $DATABASE_URL -f db/add_stripe_webhook_events.sql).

create table if not exists stripe_webhook_events (
  id text primary key,
  created_at timestamptz not null default now()
);

-- Staré záznamy nie je dôvod držať navždy -- stačí pokryť realistické okno
-- pre Stripe retry (dni, nie mesiace). Voliteľné: spúšťať periodicky, napr.
-- cez pg_cron alebo manuálne raz za čas.
-- delete from stripe_webhook_events where created_at < now() - interval '30 days';
