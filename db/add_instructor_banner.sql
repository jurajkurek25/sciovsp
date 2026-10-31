-- Reklamný banner inštruktora (jeho vlastné doučovacie/iné služby),
-- zobrazený pod kartou lektora na stránke kurzu. Klik ide cez
-- /api/courses/:slug/banner-click (zaloguje sa a presmeruje), aby
-- inštruktor videl, koľko ľudí z kurzu prešlo k jeho službám.
alter table instructors add column if not exists banner_image_url text;
alter table instructors add column if not exists banner_link_url text;

create table if not exists instructor_banner_clicks (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references instructors(id) on delete cascade,
  course_id uuid references courses(id) on delete set null,
  clicked_at timestamptz not null default now()
);

create index if not exists idx_instructor_banner_clicks_instructor on instructor_banner_clicks (instructor_id);
create index if not exists idx_instructor_banner_clicks_course on instructor_banner_clicks (course_id);
