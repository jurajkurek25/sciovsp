-- Zákaz používania celej appky (nie len komunity — pozri existujúci
-- users.community_banned_at) kvôli zneužitiu duplicitných účtov na
-- obchádzanie limitu bezplatných AI testov. Samostatné polia, lebo
-- community_banned_at rieši len prístup do komunity.
alter table users add column if not exists app_banned_at timestamptz;
alter table users add column if not exists app_ban_reason text;

create index if not exists idx_users_app_banned_at
  on users (app_banned_at)
  where app_banned_at is not null;

-- Google display meno uložené pri prvom prihlásení (/api/auth/verify) --
-- jediný spôsob, ako zistiť "rovnaké meno, iný email" (auth.users nie je
-- čitateľné cez bežný PostgREST klient). Používa ho auto-ban logika v
-- main-app-patches/298: nový účet s rovnakým menom ako existujúci účet,
-- ktorý už vyčerpal bezplatné testy, sa rovno založí ako zabanovaný.
alter table users add column if not exists signup_name text;

create index if not exists idx_users_signup_name
  on users (lower(signup_name))
  where signup_name is not null;
