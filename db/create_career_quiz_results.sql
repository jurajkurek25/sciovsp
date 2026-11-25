-- Career quiz ("kam-na-vysoku") lead capture table.
-- Run this once in the Supabase SQL editor for the sciovsp project.
-- The page (public/kam-na-vysoku.html) writes to this table directly from
-- the browser using the anon key, right after Google login — RLS below
-- restricts every row to its own owner, so the anon key can never read or
-- write anyone else's result.

create table if not exists public.career_quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  answers jsonb not null,
  scores jsonb not null,
  top_field text not null,
  created_at timestamptz not null default now()
);

create index if not exists career_quiz_results_user_id_idx on public.career_quiz_results(user_id);

alter table public.career_quiz_results enable row level security;

drop policy if exists career_quiz_results_insert_own on public.career_quiz_results;
create policy career_quiz_results_insert_own on public.career_quiz_results
  for insert
  with check (auth.uid() = user_id);

drop policy if exists career_quiz_results_select_own on public.career_quiz_results;
create policy career_quiz_results_select_own on public.career_quiz_results
  for select
  using (auth.uid() = user_id);
