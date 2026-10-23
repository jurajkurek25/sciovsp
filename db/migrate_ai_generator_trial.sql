alter table users
  add column if not exists ai_generator_trial_used boolean not null default false;
