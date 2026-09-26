-- Odteraz je marketing_emails_opt_out defaultne TRUE (odhlásený) namiesto
-- FALSE — nový používateľ nedostane marketingové/affiliate emaily, kým to
-- niekde explicitne nezaškrtne. Existujúcich používateľov toto NEMENÍ
-- (iba default pre nové riadky bez explicitnej hodnoty) — tí dostanú
-- jednorazový re-permission email (samostatný skript).
alter table public.users alter column marketing_emails_opt_out set default true;

-- Sledovanie, komu uz bol poslany jednorazovy re-permission email, aby sa
-- skript dal bezpecne spustit len raz (idempotentne).
alter table public.users add column if not exists remarketing_consent_email_sent_at timestamptz;
