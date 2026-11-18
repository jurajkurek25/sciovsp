-- Fyzické publikácie (tlačené knihy) cez Lulu Print API, fulfillment-on-demand.
-- Súbory (interiér + obal, PDF) sa ukladajú do privátneho Supabase Storage
-- bucketu "physical-products" (over/vytvor v Supabase dashboarde -- Storage →
-- New bucket → name "physical-products", Public = OFF).
--
-- Cena sa NEPÍŠE ručne -- admin nastaví len maržu (margin_percent), skutočná
-- cena (price_cents) sa dopočíta z Lulu Cost Calculator API (tlač + doprava +
-- DPH pre referenčnú SK adresu) + marža. "Prepočítať cenu" v administrácii.
create table if not exists physical_products (
  id bigserial primary key,
  slug text not null unique,
  title text not null,
  description text,
  source_digital_product_id bigint references digital_products(id), -- z ktorého digitálneho produktu tlačená verzia vychádza (voliteľné)
  pod_package_id text not null,          -- Lulu SKU, napr. '0600X0900.BW.STD.PB.060UW444.MXX'
  page_count integer not null,
  interior_storage_path text not null,   -- cesta v bucketi "physical-products"
  cover_storage_path text not null,
  cover_image_url text,                  -- verejný obrázok pre katalóg/predajnú stránku (voliteľné, inak sa karta zobrazí bez náhľadu)
  margin_percent numeric not null default 35,
  base_cost_cents integer,               -- posledná Lulu kalkulácia (tlač + doprava + DPH, referenčná SK adresa)
  price_cents integer,                   -- base_cost_cents * (1 + margin_percent/100), zaokrúlené -- NULL, kým sa cena neprepočíta
  currency text not null default 'EUR',
  price_calculated_at timestamptz,
  active boolean not null default false, -- defaultne SKRYTÉ -- admin musí explicitne aktivovať po overení ceny a súborov
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists physical_product_orders (
  id bigserial primary key,
  physical_product_id bigint not null references physical_products(id),
  buyer_email text not null,
  stripe_session_id text not null unique,
  amount_paid_cents integer not null,
  shipping_address jsonb not null,
  lulu_print_job_id bigint,
  lulu_status text not null default 'pending', -- pending | CREATED | UNPAID | PRODUCTION_DELAYED | IN_PRODUCTION | SHIPPED | ... (zrkadlí Lulu Print-Job status) | error
  lulu_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_physical_product_orders_email on physical_product_orders (buyer_email);
create index if not exists idx_physical_product_orders_lulu_job on physical_product_orders (lulu_print_job_id);

-- Pokus o vytvorenie privátneho storage bucketu priamo cez SQL -- bezpečne
-- preskočí, ak už existuje. Over si výsledok aj v dashboarde (Storage).
insert into storage.buckets (id, name, public)
values ('physical-products', 'physical-products', false)
on conflict (id) do nothing;
