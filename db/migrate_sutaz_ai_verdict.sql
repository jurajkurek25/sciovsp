-- AI overenie dokladu o prijatí (/sutaz) -- pridáva dve polia na
-- sutaz_applications. Appka NIKDY neukladá obsah dokladu ani citlivé
-- údaje z neho (rodné číslo, adresa, dátum narodenia...) -- len
-- strojový verdikt a krátke, defenzívne očistené odôvodnenie.
--
-- Spusti v Supabase SQL editore (idempotentné, dá sa spustiť aj opakovane).

alter table sutaz_applications
  add column if not exists ai_verdict text, -- 'admitted' | 'not_admitted' | 'unclear' | null (AI nedostupná/zlyhala)
  add column if not exists ai_reason text; -- krátke odôvodnenie, bez osobných údajov (očistené pri zápise)
