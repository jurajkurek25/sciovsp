-- Extends webinar_registrations (from db/create_webinar_registrations.sql)
-- with two more send-once flags for the extended follow-up sequence:
-- an urgency reminder still within the 24h offer window, and a nurture
-- email after the offer has expired. Purely additive.

alter table public.webinar_registrations
  add column if not exists offer_reminder_sent_at timestamptz,
  add column if not exists post_offer_nurture_sent_at timestamptz;
