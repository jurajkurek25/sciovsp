-- Doplnok k migrate_physical_products.sql -- ukladá rozpis ceny z Lulu Cost
-- Calculatora (tlač vs. doprava) namiesto len jedného spočítaného čísla,
-- aby bolo v administrácii vidno a overiteľné, že doprava je v cene
-- skutočne započítaná (total_cost_incl_tax z Lulu API ju už obsahuje,
-- toto len robí ten fakt viditeľný).
alter table physical_products add column if not exists shipping_cost_cents integer;
