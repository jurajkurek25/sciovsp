-- Niektorí reálni useri existujú len v Supabase Auth (auth.users), bez
-- zodpovedajúceho riadku v public.users — ten sa doteraz vytváral iba
-- "lazy", pri konkrétnych akciách (checkout, trial check...), nie pri
-- samotnej registrácii. Preto im main-app-patches/263 neposlal email o
-- zmene podmienok a main-app-patches/264 by ich ani nevedel automaticky
-- vymazať.
--
-- 1) Spätne doplní chýbajúce riadky.
-- 2) Trigger zabezpečí, že sa to od teraz deje automaticky pri KAŽDEJ
--    novej registrácii (email, Google OAuth, telefón), nezávisle od
--    toho, či a kedy používateľ v appke spustí nejakú ďalšiu akciu.

-- ── 1) Spätné doplnenie chýbajúcich riadkov ──
insert into public.users (email)
select au.email
from auth.users au
left join public.users pu on pu.email = au.email
where au.email is not null
  and pu.email is null
on conflict (email) do nothing;

-- ── 2) Automatická synchronizácia od teraz ──
create or replace function public.handle_new_auth_user()
returns trigger as $$
begin
  if new.email is not null then
    insert into public.users (email)
    values (new.email)
    on conflict (email) do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
