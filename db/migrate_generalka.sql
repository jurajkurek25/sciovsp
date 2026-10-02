-- SP Generálka — jednorázový produkt (5,90 €, jeden nákup = jeden pokus):
-- kompletný AI-generovaný test (66 úloh, 33 verbálnych + 33 analytických)
-- s podrobným trackovaním priebehu (zmeny odpovedí, čas na úlohu,
-- fullscreen/tab-switch udalosti, webkamera) a AI analýzou výsledku po
-- odovzdaní. Jeden riadok = jeden nákup = jeden pokus (žiadna samostatná
-- "purchases" tabuľka, keďže vzťah je 1:1).
create table if not exists public.generalka_attempts (
  id bigserial primary key,
  email text not null,
  stripe_session_id text unique not null,
  amount_paid_cents integer not null,
  attempt_token text unique not null,
  -- 'paid' -> 'in_progress' -> 'completed'
  status text not null default 'paid',
  questions jsonb,
  events jsonb not null default '[]'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  score numeric(5,2),
  correct int,
  wrong int,
  skipped int,
  verbal_pct int,
  analyt_pct int,
  est_pct int,
  duration_s int,
  webcam_summary jsonb,
  anticheat_flags jsonb,
  ai_analysis text,
  paid_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index if not exists generalka_attempts_email_idx on public.generalka_attempts (email);
create unique index if not exists generalka_attempts_token_idx on public.generalka_attempts (attempt_token);

-- Backend beží výhradne cez service-role kľúč (rovnaký princíp ako
-- webinar_registrations, community_* atď.) — RLS nie je potrebné.
