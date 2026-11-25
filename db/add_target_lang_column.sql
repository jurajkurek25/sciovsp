-- Pridáva target_lang stĺpec do blog_posts — súčasť delenia PR článkov
-- podľa cieľového publika (SK/CZ/both), nastavuje ho appka ad.sptrener.online
-- cez /api/internal/publish-blog-post. Default 'both' zachováva doterajšie
-- správanie pre existujúce (organické) články — zobrazujú sa v oboch
-- jazykových verziách blogu ako doteraz.
--
-- Hodnoty používajú rovnakú konvenciu ako appka ad.sptrener.online: 'sk' |
-- 'cz' | 'both' (nie interné 'cs' blogu — prevod sa deje v /blog route).
--
-- Spusti cez Supabase SQL Editor (odporúčané).

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS target_lang TEXT DEFAULT 'both';
