-- Jednorazový osobný list o konci modelu predplatného SP TRÉNER + prechode na
-- jednorazový 7 EUR Claude Skill (Gumroad). Posiela sa VŠETKÝM userom (celá
-- databáza, nielen free tier) -- stĺpec na sledovanie odoslania, rovnaký vzor
-- ako flash_discount_oct2026_sent_at.
alter table users add column if not exists shutdown_letter_sent_at timestamptz;
