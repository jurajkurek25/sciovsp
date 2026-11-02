-- Jazyk, v ktorom bol test vygenerovaný (podľa jazyka appky v čase spustenia
-- pokusu) — používa sa aj pri generovaní finálnej AI analýzy, aby sedela
-- s jazykom testu.
alter table public.generalka_attempts add column if not exists lang text not null default 'sk';
