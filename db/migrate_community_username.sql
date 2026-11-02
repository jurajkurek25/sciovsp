-- Doplňuje community_profiles o unikátne, používateľom voliteľné
-- používateľské meno (username) — nahrádza email ako fallback zobrazovaný
-- iným členom komunity (predtým sa v zozname členov/rebríčku/správach
-- zobrazoval surový email, ak si niekto nenastavil zobrazované meno; to je
-- únik súkromia, ktorý toto rieši). Profil (a teda aj username) sa
-- automaticky vygeneruje pri prvom prístupe do komunity — pozri
-- ensureProfile v routes/community.js.
alter table public.community_profiles
  add column if not exists username text;
create unique index if not exists community_profiles_username_unique on public.community_profiles (username) where username is not null;
