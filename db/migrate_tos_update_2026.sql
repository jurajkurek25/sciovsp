-- Jednorazová zmena obchodných podmienok (telefónne číslo + marketingový
-- bonus-test, main-app-patches/261 v legal.html) — umožňuje userom jedným
-- klikom z emailu buď potvrdiť, alebo "nesúhlasím, vymaž môj účet".
-- main-app-patches/262 (routy), main-app-patches/263 (hromadný email),
-- main-app-patches/264 (automatické zmazanie po termíne).
alter table users add column if not exists tos_update_token text unique;
alter table users add column if not exists tos_update_status text not null default 'pending';
alter table users add column if not exists tos_update_notice_sent_at timestamptz;
alter table users add column if not exists tos_update_confirmed_at timestamptz;

create index if not exists idx_users_tos_update_token on users(tos_update_token);
