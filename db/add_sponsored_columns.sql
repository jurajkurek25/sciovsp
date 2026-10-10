-- Pridáva stĺpce na označenie PR (sponzorovaných) článkov na blogu —
-- súčasť nového typu reklamy "PR článok na blog" na ad.sptrener.online.
-- Samotné rozlíšenie pre čitateľa rieši viditeľný "Partnerský obsah" odsek
-- priamo v content/content_cs (vkladá ho AI pri generovaní), tieto stĺpce
-- slúžia na filtrovanie/reporting.
--
-- Spusti cez Supabase SQL Editor (odporúčané — schema cache sa netreba
-- riešiť), alebo cez psql/pripojený klient + NOTIFY nižšie.

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS sponsored BOOLEAN DEFAULT FALSE;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS sponsor_name TEXT;

-- Ak spúšťaš priamo cez psql/iný priamy SQL klient (nie Supabase SQL Editor),
-- toto je NUTNÉ, inak PostgREST (API vrstva) o nových stĺpcoch nebude vedieť
-- a insert cez /api/internal/publish-blog-post bude tichoichyba zlyhávať:
NOTIFY pgrst, 'reload schema';
