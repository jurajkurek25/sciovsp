-- Pozvánka do súťaže "/sutaz" pre nových registrovaných -- posiela sa
-- pár dní po registrácii, len počas otvoreného prihlasovania a len tým,
-- ktorí ešte nepodali prihlášku. Táto jedna kolónka zabraňuje opakovanému
-- posielaniu (rovnaký vzor ako generalka_offer_sent_at/exam_goodluck_sent_at).
--
-- Spusti v Supabase SQL editore (idempotentné).

alter table users
  add column if not exists sutaz_promo_email_sent_at timestamptz;
