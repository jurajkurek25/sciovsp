-- Globálny (na klane nezávislý) tréningový streak — používa ho Elite denný
-- email so streakom + odpočtom do testu. Na rozdiel od clan_stats funguje
-- pre KAŽDÉHO usera, aj toho, kto nie je v žiadnom klane.
create table if not exists training_streaks (
  email text primary key,
  streak_days int not null default 0,
  last_active_date date,
  best_percentile numeric,
  last_streak_email_sent_date date,
  updated_at timestamptz not null default now()
);

-- Osobný termín testu (voliteľný, nastavuje si ho user v appke) — používa
-- ho: (1) Elite denný email s odpočtom (ak nie je nastavený, padá na
-- najbližší celoplošný termín), (2) automatický "veľa šťastia" email v deň
-- testu, (3) žiadosť o recenziu deň po teste.
alter table users add column if not exists exam_date date;
alter table users add column if not exists exam_goodluck_sent_at timestamptz;
alter table users add column if not exists exam_review_token text;
alter table users add column if not exists exam_review_requested_at timestamptz;

-- Recenzie zozbierané cez /recenzia formulár (odkaz v emaili deň po teste).
create table if not exists app_reviews (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  rating int,
  message text,
  created_at timestamptz not null default now()
);
