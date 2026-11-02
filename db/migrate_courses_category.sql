-- Pridáva kategóriu na kurzy, aby /kurzy mohla mať kategorizáciu (pills)
-- rovnako ako /odporucame (main-app-patches/208). courses doteraz nemala
-- žiadny kategorizačný stĺpec vôbec.
--
-- 3 kategórie zodpovedajú tomu, čo je reálne v DB (6 kurzov, overené cez
-- main-app-patches/207 diagnostiku -- nie vymyslené):
--   priprava-na-skusku: Test štúdijných predpokladov na prvý pokus,
--                        Príprava na bakalárske štúdium psychológie
--   prihlaska:          Motivačný list a esej
--   osobny-rozvoj:       Time manažment, Stres a nervozita pred skúškou,
--                        Základy efektívneho učenia
--
-- Spusti v Supabase SQL editore (alebo cez psql $DATABASE_URL -f db/migrate_courses_category.sql).

alter table courses add column if not exists category text;

update courses set category = 'priprava-na-skusku'
  where slug in ('test-studijnych-predpokladov-na-prvy-pokus', 'priprava-na-bakalarke-studium-psychologie');

update courses set category = 'prihlaska'
  where slug in ('motivacny-list-a-esej');

update courses set category = 'osobny-rozvoj'
  where slug in ('time-manazment', 'stres-a-nervozita-pred-skuskou', 'zaklady-efektivneho-ucenia');
