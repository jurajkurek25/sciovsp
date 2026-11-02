-- Denný strop pre /api/mentor (Elite "AI Mentor chat") — predtým úplne
-- neobmedzený (len generický 20 req/min rate limit), jediná ochrana proti
-- tomu, aby jeden power-user minul v API nákladoch viac, než appka
-- zarobí na jeho Elite predplatnom.
alter table users add column if not exists mentor_messages_count integer not null default 0;
alter table users add column if not exists mentor_messages_date date;
