-- SP Tréner Ads + Blog — schéma pre PRODUKČNÝ Supabase projekt
-- (zrnqiwareacqyndwchsv). Spusti v Supabase Dashboard → SQL Editor.
-- Bezpečné spúšťať opakovane (IF NOT EXISTS / ON CONFLICT DO NOTHING všade).
--
-- Zámerne NEPOUŽÍVA cudzí kľúč na public.users ani auth.users — celý zvyšok
-- server.js identifikuje používateľov cez email (nie id), takže sa toho tu
-- držíme kvôli konzistencii (video_ad_views.user_email je obyčajný text stĺpec).

-- ─── Blog ───────────────────────────────────────────────────────────────
create table if not exists blog_posts (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  title       text not null,
  excerpt     text not null,
  content     text not null,   -- HTML
  tag         text,
  read_time   text,
  published   boolean default true,
  created_at  timestamptz default now()
);

-- ─── Inzerenti (ad.sptrener.online) ────────────────────────────────────
-- Autentifikácia je Supabase magic-link (rovnako ako hlavná appka) — žiadne
-- heslo/JWT tu netreba, preto tabuľka nemá password_hash.
create table if not exists advertisers (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique not null,
  company_name       text,
  stripe_customer_id text unique,
  created_at         timestamptz default now()
);

-- Bannery (PNG/GIF/MP4 bez zvuku) — súbor žije v Storage bucket 'ad-banners',
-- tu je len cesta/URL. Predplatné sa platí za KAŽDÝ banner samostatne.
create table if not exists ad_banners (
  id                     uuid primary key default gen_random_uuid(),
  advertiser_id          uuid references advertisers(id) on delete cascade,
  storage_path           text not null,
  public_url             text not null,
  mime_type              text not null,
  link_url               text not null,
  active                 boolean default true,
  stripe_subscription_id text unique,
  status                 text default 'pending_payment', -- pending_payment | active | past_due | cancelled
  current_period_end     timestamptz,
  created_at             timestamptz default now()
);

create table if not exists ad_events (
  id          uuid primary key default gen_random_uuid(),
  banner_id   uuid references ad_banners(id) on delete cascade,
  event_type  text not null, -- 'impression' | 'click'
  created_at  timestamptz default now()
);

-- Video reklamy (so zvukom) — súbor v Storage bucket 'video-ads'.
create table if not exists video_ads (
  id                     uuid primary key default gen_random_uuid(),
  advertiser_id          uuid references advertisers(id) on delete cascade,
  storage_path           text not null,
  public_url             text not null,
  mime_type              text not null,
  duration_s             int not null,
  link_url               text not null,
  active                 boolean default true,
  stripe_subscription_id text unique,
  status                 text default 'pending_payment',
  current_period_end     timestamptz,
  created_at             timestamptz default now()
);

-- Zhliadnutia — anti-cheat session (start/complete), denný limit, kliky.
create table if not exists video_ad_views (
  id             uuid primary key default gen_random_uuid(),
  video_ad_id    uuid references video_ads(id) on delete cascade,
  user_email     text not null,
  session_token  text unique not null,
  started_at     timestamptz default now(),
  completed_at   timestamptz,
  reward_granted boolean default false,
  clicked        boolean default false
);

create index if not exists idx_blog_posts_slug on blog_posts(slug);
create index if not exists idx_blog_posts_published on blog_posts(published, created_at desc);
create index if not exists idx_advertisers_email on advertisers(email);
create index if not exists idx_ad_banners_advertiser on ad_banners(advertiser_id);
create index if not exists idx_ad_banners_status on ad_banners(status);
create index if not exists idx_ad_events_banner on ad_events(banner_id);
create index if not exists idx_video_ads_advertiser on video_ads(advertiser_id);
create index if not exists idx_video_ads_status on video_ads(status);
create index if not exists idx_video_ad_views_video on video_ad_views(video_ad_id);
create index if not exists idx_video_ad_views_email_day on video_ad_views(user_email, completed_at);
create index if not exists idx_video_ad_views_token on video_ad_views(session_token);

-- ─── Storage buckety (verejné čítanie — kreatívy nie sú citlivý obsah) ──
insert into storage.buckets (id, name, public)
values ('ad-banners', 'ad-banners', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('video-ads', 'video-ads', true)
on conflict (id) do nothing;
