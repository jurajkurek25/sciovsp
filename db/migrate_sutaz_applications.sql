-- Súťaž "/sutaz" o darčekové poukážky Martinus — prihlášky účastníkov.
-- Jedna osoba = jeden vstup (unique na email, vynútené aj na úrovni DB,
-- nielen v appke). Doklad o prijatí sa NEUKLADÁ sem -- len cesta
-- (admission_doc_path) do privátneho Storage bucketu nižšie; appka ho
-- nikdy nevystavuje cez getPublicUrl.
--
-- Spusti v Supabase SQL editore (alebo cez psql $DATABASE_URL -f db/migrate_sutaz_applications.sql).

create table if not exists sutaz_applications (
  id uuid primary key default gen_random_uuid(),
  email text not null unique, -- e-mail účtu SP TRENER (čl. IV ods. 1)
  full_name text not null,
  contact_email text not null, -- súťažný kontaktný e-mail, môže byť iný než účet (čl. IV ods. 1)
  residence_municipality text not null, -- obec bydliska (čl. IV ods. 1)
  residence_country text not null, -- štát bydliska (čl. IV ods. 1) -- appka vynucuje SR (čl. III ods. 1)
  school_name text not null,
  study_program text not null,
  admission_decision_date date not null,
  admission_doc_path text not null,
  admission_doc_mime text not null,
  age_confirmed boolean not null default false,
  statute_ack boolean not null default false,
  -- Snapshot oprávnenosti v momente prihlásenia (pre audit/review, nie
  -- pre opätovné vyhodnocovanie -- ak sa users dáta neskôr zmenia,
  -- tento záznam ostáva ako dôkaz, že v momente podania prihláška
  -- splnila podmienky).
  verified_tests_count int,
  verified_is_premium boolean,
  verified_plan text,
  verified_subscription_status text,
  status text not null default 'pending', -- 'pending' | 'verified' | 'rejected' | 'winner'
  reviewer_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists idx_sutaz_applications_status on sutaz_applications (status);

-- Privátny bucket pre doklady o prijatí -- public=false, prístupný len
-- servisným kľúčom (nikdy cez getPublicUrl/anon klienta).
insert into storage.buckets (id, name, public)
values ('sutaz-admission-docs', 'sutaz-admission-docs', false)
on conflict (id) do nothing;
