alter table users
  add column if not exists marketing_bonus_test_claimed boolean not null default false;
