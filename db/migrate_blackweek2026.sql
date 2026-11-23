-- Jednorazová Black Week kampaň (-40%, platná len do 27.11.2026 23:59) --
-- stĺpec na sledovanie odoslania, rovnaký vzor ako flash_discount_oct2026_sent_at.
alter table users add column if not exists blackweek2026_sent_at timestamptz;
