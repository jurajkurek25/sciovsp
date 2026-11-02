alter table users
  add column if not exists ai_generator_trial_count integer not null default 0;

-- Preklop existujúcich účtov, čo už minuli svoje 1 bezplatné použitie
-- (main-app-patches/255) na stav "3/3 minuté", nech im patch 256
-- nevynuluje počítadlo a nedá im omylom 3 nové zadarmo navyše.
update users set ai_generator_trial_count = 3 where ai_generator_trial_used = true;
