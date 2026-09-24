-- Automatické AI affiliate kampane: admin v Dash zapíše partnera a čo
-- predáva (affiliate_campaigns), systém podľa target_signal nájde vhodných
-- príjemcov (users.marketing_emails_opt_out = false vždy rešpektované),
-- AI raz vygeneruje text kampane (generated_subject/generated_body_html,
-- zdieľaný pre všetkých príjemcov — negenerujeme zvlášť pre každého),
-- a server.js (sendAffiliateCampaignEmails, setInterval) ho pošle. Každý
-- email na kampaň dostane iba raz (affiliate_campaign_sends, unique).
create table if not exists public.affiliate_campaigns (
  id uuid primary key default gen_random_uuid(),
  partner_name text not null,
  product_description text not null,
  cta_url text not null,
  target_signal text not null check (target_signal in ('all','course','generalka_buyer','exam_soon')),
  target_course_id uuid references public.courses(id),
  exam_days_before int,
  lookback_days int not null default 30,
  subject_hint text,
  generated_subject text,
  generated_body_html text,
  generated_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.affiliate_campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.affiliate_campaigns(id) on delete cascade,
  email text not null,
  sent_at timestamptz not null default now(),
  unique(campaign_id, email)
);
create index if not exists affiliate_campaign_sends_campaign_idx on public.affiliate_campaign_sends(campaign_id);
