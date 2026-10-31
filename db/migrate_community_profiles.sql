-- Profily (vlastná profilová fotka, bio) + samostatná galéria fotiek pre
-- študentskú komunitu (routes/community.js). Rovnaký prístupový princíp
-- ako community_posts/community_comments — gate je výhradne
-- users.community_access_until (webinárová cesta nákupu Premium/Elite),
-- backend beží cez service-role kľúč, RLS nie je potrebné.

create table if not exists public.community_profiles (
  email text primary key,
  display_name text,
  avatar_url text,
  bio text,
  updated_at timestamptz not null default now()
);

create table if not exists public.community_photos (
  id bigserial primary key,
  author_email text not null,
  author_name text,
  image_url text not null,
  caption text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists community_photos_created_idx on public.community_photos (created_at desc) where deleted_at is null;
create index if not exists community_photos_author_idx on public.community_photos (author_email, created_at desc) where deleted_at is null;
