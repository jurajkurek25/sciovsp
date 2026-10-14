-- Inštruktorská platforma (instructor.sptrener.online).
-- Zdieľa Supabase projekt s hlavnou appkou — inštruktor sa prihlasuje
-- rovnakým Google/Supabase Auth ako kupujúci kurzov, žiadny samostatný
-- auth systém. "cut" = podiel PLATFORMY (SP Tréner) z ceny; inštruktor
-- si necháva zvyšok. Keď kurz kúpi niekto cez inštruktorov vlastný
-- referral odkaz, platforma si necháva iba referral_cut_percent (10 %),
-- lebo zákazníka priviedol inštruktor sám.

create table if not exists instructors (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  bio text,
  photo_url text,
  iban text,
  default_cut_percent integer not null default 50 check (default_cut_percent >= 0 and default_cut_percent <= 100),
  referral_code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

-- Kurz patrí inštruktorovi (nullable — existujúce admin-autorské kurzy
-- ostávajú bez instructor_id, len s textovou instructor_* kartou).
alter table courses add column if not exists instructor_id uuid references instructors(id) on delete set null;
alter table courses add column if not exists platform_cut_percent integer not null default 50 check (platform_cut_percent >= 0 and platform_cut_percent <= 100);
alter table courses add column if not exists referral_cut_percent integer not null default 10 check (referral_cut_percent >= 0 and referral_cut_percent <= 100);
-- Inštruktor si kurz pripraví, ale nezverejní sa (published), kým to Juraj neschváli v dashi.
alter table courses add column if not exists submitted_for_review boolean not null default false;

create table if not exists instructor_payouts (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references instructors(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  iban text not null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  note text
);

-- Snapshot pri kúpe: koľko si necháva platforma a koľko inštruktor,
-- podľa sadzby platnej V TEJ CHVÍLI (neskoršia zmena platform_cut_percent
-- na kurze historické kúpy nezmení). instructor_payout_id sa vyplní, keď
-- sa táto kúpa zahrnie do vyžiadaného výberu.
alter table course_purchases add column if not exists instructor_id uuid references instructors(id) on delete set null;
alter table course_purchases add column if not exists instructor_share_cents integer;
alter table course_purchases add column if not exists via_instructor_referral boolean not null default false;
alter table course_purchases add column if not exists instructor_payout_id uuid references instructor_payouts(id) on delete set null;

create index if not exists idx_courses_instructor on courses (instructor_id);
create index if not exists idx_course_purchases_instructor_unpaid on course_purchases (instructor_id) where instructor_payout_id is null;
create index if not exists idx_instructor_payouts_instructor on instructor_payouts (instructor_id);
