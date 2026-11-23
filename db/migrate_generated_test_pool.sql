-- Zdieľaný pool vygenerovaných plných testov (66 úloh) na opakované
-- použitie medzi klientmi -- namiesto volania AI pre každého klienta
-- znova, ak už existuje vhodný vygenerovaný test, ktorý tento konkrétny
-- človek ešte nevidel. Platí pre VŠETKÝCH (free aj Premium/Elite).
create table if not exists generated_test_pool (
  id bigserial primary key,
  lang text not null,
  difficulty text not null,
  questions jsonb not null,
  verbal_count integer not null,
  analytical_count integer not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_generated_test_pool_lang_diff on generated_test_pool (lang, difficulty, created_at);

-- Sleduje, ktoré testy z poolu už ktorý prihlásený email videl, aby sa mu
-- nikdy neposlal duplikát. Anonymní používatelia (bez emailu) sa tu
-- nesledujú -- majú nárok len na jeden bezplatný test bez registrácie
-- celkovo (vynucované inde, trial_abuse_signals), takže nehrozí im
-- opakovanie v rámci tohto jedného testu.
create table if not exists user_seen_tests (
  email text not null,
  test_id bigint not null references generated_test_pool(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (email, test_id)
);
