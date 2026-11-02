-- Unsubscribe systém pre emaily naviazané na prihlásených userov (users
-- tabuľka) — elite streak, exam goodluck/recenzia, generálka ponuka. Doteraz
-- mali unsubscribe len webinárové a kvízové (leads) emaily, tieto nie.
alter table public.users add column if not exists unsubscribe_token text;
alter table public.users add column if not exists marketing_emails_opt_out boolean not null default false;
create unique index if not exists users_unsubscribe_token_idx on public.users (unsubscribe_token) where unsubscribe_token is not null;

-- Jazyk zvolený pri registrácii na webinár — webinárové emaily (1-6) doteraz
-- chodili výhradne po slovensky bez ohľadu na jazyk appky.
alter table public.webinar_registrations add column if not exists lang text not null default 'sk';

-- Trvalá jazyková preferencia usera — potrebná pre cronové emaily (elite
-- streak, exam goodluck/recenzia, generálka ponuka), ktoré bežia na pozadí
-- nezávisle od toho, aký jazyk má momentálne nastavený v prehliadači.
-- Synchronizuje sa z localStorage vsp_lang cez POST /api/profile/lang
-- vždy, keď user v appke prepne jazyk.
alter table public.users add column if not exists lang text not null default 'sk';
