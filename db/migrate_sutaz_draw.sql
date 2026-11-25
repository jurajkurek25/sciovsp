-- Žrebovanie súťaže "/sutaz" -- unikátny súťažný kód pre každého
-- overeného účastníka (čl. VI ods. 1 štatútu) a zápisnica žrebovania
-- (čl. VI ods. 2 -- dátum, počet platných vstupov, spôsob výberu, kód
-- výhercu/náhradníka).
--
-- Spusti v Supabase SQL editore (idempotentné).

alter table sutaz_applications
  add column if not exists participant_code text unique, -- 6-miestny kód, generuje sa pri prechode do 'verified'
  add column if not exists draw_position int; -- 1 = výherca, 2+ = náhradníci v poradí žrebovania; null = ešte nežrebovaný

create table if not exists sutaz_draws (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references sutaz_applications(id),
  code text not null,
  position int not null,
  eligible_pool_size int not null, -- počet platných vstupov v momente tohto žrebu (čl. VI ods. 2)
  drawn_at timestamptz not null default now()
);

create index if not exists idx_sutaz_draws_position on sutaz_draws (position);
