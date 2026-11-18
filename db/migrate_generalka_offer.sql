-- Sledovanie, či bol používateľovi už poslaný email s ponukou SP Generálky
-- pred jeho termínom testu (users.exam_date) — jeden email na jeden termín,
-- podobne ako exam_goodluck_sent_at/exam_review_requested_at (patch 105/107).
alter table public.users add column if not exists generalka_offer_sent_at timestamptz;
