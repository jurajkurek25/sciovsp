-- Kryptograficky overiteľné žrebovanie súťaže "/sutaz" (commit-reveal).
--
-- Pred žrebovaním appka vygeneruje tajný seed, HNEĎ zverejní jeho
-- SHA-256 hash (seed_hash) a zoznam všetkých kódov v tom momente
-- (pool_snapshot) -- toto je dôkaz, že seed sa po zverejnení hashu už
-- nedá zmeniť (nikto nevie nájsť iný text so zhodným SHA-256 hashom).
-- Po žrebovaní appka odhalí samotný seed (reveal). Ktokoľvek si potom
-- vie sám prepočítať: SHA-256(odhalený seed) == zverejnený seed_hash,
-- a z (seed, pool_snapshot) deterministickým algoritmom (HMAC-SHA256,
-- popísaný v čl. VI štatútu) prepočítať presne tých istých výhercov,
-- akých appka oznámila.
--
-- Spusti v Supabase SQL editore.

create table if not exists sutaz_draw_commitment (
  id uuid primary key default gen_random_uuid(),
  seed text, -- 64-znakový hex reťazec, NULL kým sa neodhalí (reveal)
  seed_hash text not null, -- SHA-256(seed) ako hex, zverejnené HNEĎ pri vytvorení
  pool_snapshot jsonb not null, -- zoradený zoznam VŠETKÝCH kódov v momente commitu (nemenný)
  committed_at timestamptz not null default now(),
  revealed_at timestamptz
);
