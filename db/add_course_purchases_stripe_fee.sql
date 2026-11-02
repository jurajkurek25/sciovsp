-- Skutočný Stripe poplatok za platbu (v centoch), zaznamenaný pri spracovaní
-- webhooku. Podiel inštruktora sa od tejto zmeny počíta z ceny ZNÍŽENEJ o
-- tento poplatok, nie z hrubej sumy — Ngroup, s. r. o. nie je platiteľom
-- DPH (DPH sa nerieši per-transakciu, ale raz ročne podľa zákona), takže
-- jediné, čo treba pred delením podielu odpočítať, je poplatok Stripe.
alter table course_purchases add column if not exists stripe_fee_cents integer;
