-- Nemenný audit log potvrdení štandardných podmienok. instructors.terms_accepted_*
-- ukazuje len AKTUÁLNY stav a pri každom novom potvrdení sa prepíše —
-- pri publikovaní novej verzie by sa tak stratil záznam o tom, kedy
-- (a z akej IP) inštruktor potvrdil tú predchádzajúcu. Tento log sa
-- nikdy nemaže ani neupravuje, len pridáva — jeden riadok na každé
-- potvrdenie, natrvalo.
create table if not exists instructor_terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references instructors(id) on delete cascade,
  version integer not null,
  accepted_at timestamptz not null default now(),
  ip text,
  user_agent text
);

create index if not exists idx_instructor_terms_acceptances_instructor on instructor_terms_acceptances (instructor_id, accepted_at desc);
