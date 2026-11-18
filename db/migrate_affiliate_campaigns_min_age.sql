-- Nový používateľ nemá hneď po registrácii dostávať affiliate kampane —
-- min_account_age_days hovorí, koľko dní staré musí byť users.created_at,
-- aby bol niekto kandidátom danej kampane. Predvolené 14 dní.
alter table public.affiliate_campaigns add column if not exists min_account_age_days int not null default 14;
