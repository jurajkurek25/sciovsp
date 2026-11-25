-- /api/zebra-builder a /api/generate-mirror sú Elite-only AI funkcie bez
-- akéhokoľvek denného stropu (len generický 20 req/min IP rate limit) --
-- rovnaký problém, aký mal /api/mentor pred migrate_mentor_daily_cap.sql.
-- /api/generate-mirror je obzvlášť nákladný: jeden request môže spustiť
-- až 6 paralelných Claude volaní po 4096 tokenov.
alter table users add column if not exists zebra_builder_count integer not null default 0;
alter table users add column if not exists zebra_builder_date date;
alter table users add column if not exists mirror_mode_count integer not null default 0;
alter table users add column if not exists mirror_mode_date date;
