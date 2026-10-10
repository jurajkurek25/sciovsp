-- Server-side, per-account webinar offer window. Replaces the old
-- cookie/localStorage-based "offer expires at end of first-visit day"
-- logic on /ponuka, which the client fully controlled. Frozen once per
-- email at first-ever registration (see main-app-patches/114) and never
-- recomputed on later registrations — one-shot forever, per the app's
-- own decision (a re-registration for a later webinar does not reopen
-- the discount window).
alter table public.webinar_registrations
  add column if not exists offer_window_started_at timestamptz,
  add column if not exists offer_window_expires_at timestamptz;
