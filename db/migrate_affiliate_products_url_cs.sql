-- Affiliate produkty (/odporucame) doteraz mali jeden spoločný "url" pre
-- SK aj CZ verziu stránky. Rozdeľuje ho na url_sk (premenovaný pôvodný
-- stĺpec) a nový url_cs, aby šlo nastaviť samostatný affiliate odkaz pre
-- slovenskú a českú časť (rôzne partnerské programy/kódy podľa krajiny).
--
-- Existujúce produkty dostanú url_cs = rovnaká hodnota ako url_sk (žiadny
-- odkaz sa tým nerozbije), admin si ich potom v dash.sptrener.online môže
-- nastaviť rozdielne.
--
-- Spusti v Supabase SQL editore (alebo cez psql $DATABASE_URL -f db/migrate_affiliate_products_url_cs.sql).

alter table public.affiliate_products rename column url to url_sk;
alter table public.affiliate_products add column if not exists url_cs text;

update public.affiliate_products set url_cs = url_sk where url_cs is null;
