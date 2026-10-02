-- Zľavové kódy pre online kurzy.
-- course_id = NULL znamená, že kód platí na ktorýkoľvek kurz.
create table if not exists course_discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  course_id uuid references courses(id) on delete cascade,
  percent_off integer not null check (percent_off > 0 and percent_off <= 100),
  max_uses integer,
  used_count integer not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_course_discount_codes_code on course_discount_codes (upper(code));

-- Ktorý kód (ak nejaký) bol pri kúpe uplatnený — pre report a na inkrement used_count vo webhooku.
alter table course_purchases add column if not exists discount_code text;
