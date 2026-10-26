-- Denné stropy pre /api/generate, /api/generate-topic, /api/solution a
-- /api/coach -- doteraz chránené len cez requireLogin (main-app-patches/280),
-- bez akéhokoľvek stropu na počet volaní pre bezplatné (neplatiace) účty.
-- Rovnaký vzor ako migrate_zebra_mirror_daily_caps.sql / migrate_mentor_daily_cap.sql.
alter table users add column if not exists generate_count integer not null default 0;
alter table users add column if not exists generate_date date;
alter table users add column if not exists generate_topic_count integer not null default 0;
alter table users add column if not exists generate_topic_date date;
alter table users add column if not exists solution_count integer not null default 0;
alter table users add column if not exists solution_date date;
alter table users add column if not exists coach_count integer not null default 0;
alter table users add column if not exists coach_date date;
