-- Ako je kurz dostupný: 'paid' (bežný predaj, default), 'free' (zadarmo pre
-- každého bez platby), 'subscription' (súčasť platených tierov predplatného
-- appky — dostupný ZADARMO, len kým má používateľ aktívne predplatné v
-- niektorom zo zaškrtnutých tierov; nie je to trvalý nákup ako course_purchases).
alter table courses add column if not exists access_mode text not null default 'paid';
alter table courses add column if not exists included_in_premium boolean not null default false;
alter table courses add column if not exists included_in_elite boolean not null default false;
