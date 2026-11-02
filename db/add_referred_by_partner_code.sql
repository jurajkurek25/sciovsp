-- Pridáva stĺpec, do ktorého appka pri prvom prihlásení uloží kód partnera,
-- cez ktorého sa bezplatný (free-tier) používateľ zaregistroval (?ref=...).
-- Slúži na priznanie bonusu partnerovi za dopozreté odmeňované video
-- bezplatným používateľom (samostatné od štandardnej platenej konverzie).
--
-- "Prvá atribúcia vyhráva" — nastavuje sa len raz, len ak je aktuálne NULL
-- (viď POST /api/referral/attach-partner v server.js).
--
-- Spusti cez Supabase SQL Editor (odporúčané).

ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_partner_code TEXT;
