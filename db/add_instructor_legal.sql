-- Zmluvné podmienky pre inštruktorov. Štandardné podmienky sú
-- verzované (nová verzia = nový riadok, staré sa nemenia) — ak sa
-- publikuje nová verzia, inštruktor musí znova potvrdiť (porovnáva sa
-- instructors.terms_accepted_version s najnovšou verziou). Okrem toho
-- vie admin nastaviť konkrétnemu inštruktorovi vlastnú (custom) dohodu
-- navyše k štandardným podmienkam — obe strany ju musia potvrdiť.
create table if not exists instructor_standard_terms (
  version integer primary key,
  content text not null,
  created_at timestamptz not null default now()
);

alter table instructors add column if not exists terms_accepted_at timestamptz;
alter table instructors add column if not exists terms_accepted_version integer;
alter table instructors add column if not exists terms_accept_ip text;
alter table instructors add column if not exists terms_accept_user_agent text;

create table if not exists instructor_custom_agreements (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references instructors(id) on delete cascade,
  title text not null,
  content text not null,
  -- admin "podpisuje" tým, že dohodu vytvorí/publikuje (created_by_admin_at);
  -- inštruktor podpisuje samostatným aktívnym potvrdením.
  created_by_admin_at timestamptz not null default now(),
  accepted_at timestamptz,
  accept_ip text,
  accept_user_agent text,
  superseded_at timestamptz -- ak admin vytvorí novú dohodu, stará sa takto archivuje namiesto mazania
);

create index if not exists idx_instructor_custom_agreements_instructor on instructor_custom_agreements (instructor_id) where superseded_at is null;
