-- Študentská komunita (feed príspevkov, komentáre, lajky) — prístup je
-- výhradne pre tých, čo si Premium/Elite kúpili cez WEBINÁROVÚ cestu na
-- /ponuka (nie cez /kam-na-vysoku kvíz token, nie cez bežné mesačné
-- predplatné) a len počas trvania tej istej platby (community_access_until
-- je nastavené na rovnaký dátum ako membership_expires_at pri aktivácii —
-- viď main-app-patches/118-community-backend.js).
alter table public.users
  add column if not exists community_access_until timestamptz,
  add column if not exists community_banned_at timestamptz;

create table if not exists public.community_posts (
  id bigserial primary key,
  author_email text not null,
  author_name text,
  body text not null,
  image_url text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists community_posts_created_idx on public.community_posts (created_at desc) where deleted_at is null;

create table if not exists public.community_comments (
  id bigserial primary key,
  post_id bigint not null references public.community_posts(id) on delete cascade,
  author_email text not null,
  author_name text,
  body text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists community_comments_post_idx on public.community_comments (post_id, created_at) where deleted_at is null;

-- Presne jedno z post_id/comment_id musí byť vyplnené — lajk patrí buď
-- príspevku, alebo komentáru, nikdy obom/žiadnemu.
create table if not exists public.community_likes (
  id bigserial primary key,
  post_id bigint references public.community_posts(id) on delete cascade,
  comment_id bigint references public.community_comments(id) on delete cascade,
  author_email text not null,
  created_at timestamptz not null default now(),
  constraint community_likes_exactly_one_target check ((post_id is not null) <> (comment_id is not null))
);
create unique index if not exists community_likes_post_unique on public.community_likes (post_id, author_email) where post_id is not null;
create unique index if not exists community_likes_comment_unique on public.community_likes (comment_id, author_email) where comment_id is not null;

-- Backend beží výhradne cez service-role kľúč (rovnaký princíp ako všade
-- inde v appke — webinar_registrations, gift_cards, atď.) — klient nikdy
-- nečíta/nezapisuje tieto tabuľky priamo cez anon kľúč, všetko ide cez
-- /api/community/* endpointy, ktoré vynucujú prístup (webinárový nákup +
-- aktívne členstvo + nie je zablokovaný). RLS teda nie je potrebné.
