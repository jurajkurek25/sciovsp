-- Extends career_quiz_results (already created by career_quiz_results.sql)
-- with the columns the new email-sequence engine needs. Run this once in
-- the Supabase SQL editor, AFTER career_quiz_results.sql.
-- Purely additive (ALTER ADD COLUMN IF NOT EXISTS) — safe to run even if
-- some columns already exist; does not touch existing rows' data.

alter table public.career_quiz_results
  add column if not exists lang text not null default 'sk',
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists email_sequence_stage int not null default 0,
  add column if not exists next_email_due_at timestamptz not null default now(),
  add column if not exists discount_token text,
  add column if not exists discount_deadline timestamptz,
  add column if not exists converted_premium_at timestamptz,
  add column if not exists top_field_name text,
  add column if not exists top_field_desc text;

-- Existing rows (created before this migration) had no sequence started —
-- give them a due time so the engine picks them up on its next pass
-- instead of leaving them stuck at stage 0 forever.
update public.career_quiz_results
  set next_email_due_at = now()
  where next_email_due_at is null and email_sequence_stage = 0;

create unique index if not exists career_quiz_results_discount_token_idx
  on public.career_quiz_results(discount_token)
  where discount_token is not null;

-- Backend sends run with the Supabase service-role key (bypasses RLS,
-- same as every other privileged write in this app — gift cards, webinar
-- registrations, etc.), so the existing owner-only RLS policies from
-- career_quiz_results.sql are untouched and still correctly restrict what
-- the anon/browser key can see.
