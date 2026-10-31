-- Jednorazová flash zľava (-35%, platná len 21.10.2026) pre všetkých
-- free userov (bez Premium/Elite) — stĺpec na sledovanie odoslania,
-- rovnaký vzor ako sutaz_promo_email_sent_at / remarketing_consent_email_sent_at.
alter table users add column if not exists flash_discount_oct2026_sent_at timestamptz;
