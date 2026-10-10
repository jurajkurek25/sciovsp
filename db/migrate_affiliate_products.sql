-- Affiliate odkazy pre verejnú stránku /odporucame (server.js, blogLayout()).
-- Admin ich spravuje v dash-service (Odporúčame panel); verejná stránka
-- ich číta priamo z tejto tabuľky, zoskupené podľa category_slug.
create table if not exists public.affiliate_products (
  id uuid primary key default gen_random_uuid(),
  category_slug text not null,
  category_title_sk text not null,
  category_title_cs text not null,
  icon text not null default '🛍️',
  title_sk text not null,
  title_cs text not null,
  description_sk text not null default '',
  description_cs text not null default '',
  cta_sk text not null default 'Pozrieť ponuku →',
  cta_cs text not null default 'Podívat se na nabídku →',
  url text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Presun doterajších natvrdo napísaných odkazov do DB (len ak tam ešte nie sú).
insert into public.affiliate_products
  (category_slug, category_title_sk, category_title_cs, icon, title_sk, title_cs, description_sk, description_cs, cta_sk, cta_cs, url, sort_order)
select 'skolske-batohy', 'Školské batohy', 'Školní batohy', '🎒', 'Školské batohy', 'Školní batohy',
  'BatohyZavazadla.cz — kvalitné batohy na školu aj na vysokú, dosť priestoru na notebook, zošity aj fľašu.',
  'BatohyZavazadla.cz — kvalitní batohy do školy i na vysokou, dost místa na notebook, sešity i láhev.',
  'Pozrieť ponuku →', 'Podívat se na nabídku →',
  'https://ehub.cz/system/scripts/click.php?a_aid=fee628bb&a_bid=ffcffc9b&desturl=https%3A%2F%2Fwww.batohyzavazadla.cz%2Fskolni-batohy%2F', 1
where not exists (select 1 from public.affiliate_products where category_slug = 'skolske-batohy');

insert into public.affiliate_products
  (category_slug, category_title_sk, category_title_cs, icon, title_sk, title_cs, description_sk, description_cs, cta_sk, cta_cs, url, sort_order)
select 'batohy-cestovanie', 'Batohy na cestovanie', 'Batohy na cestování', '🧳', 'Batohy na cestovanie', 'Batohy na cestování',
  'BatohyZavazadla.cz — cestovné batohy a ruksaky na výlety aj dlhšie cesty.',
  'BatohyZavazadla.cz — cestovní batohy a batůžky na výlety i delší cesty.',
  'Pozrieť ponuku →', 'Podívat se na nabídku →',
  'https://ehub.cz/system/scripts/click.php?a_aid=fee628bb&a_bid=ffcffc9b&desturl=https%3A%2F%2Fwww.batohyzavazadla.cz%2Fna-cestovani%2F', 2
where not exists (select 1 from public.affiliate_products where category_slug = 'batohy-cestovanie');
