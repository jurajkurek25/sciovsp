-- Obchod s digitálnymi produktami (PDF, EPUB, MOBI, .skill, ZIP...).
-- Súbory sa ukladajú do privátneho Supabase Storage bucketu
-- "digital-products" (over/vytvor v Supabase dashboarde -- Storage →
-- New bucket → name "digital-products", Public = OFF).
create table if not exists digital_products (
  id bigserial primary key,
  slug text not null unique,
  title text not null,
  description text,
  price_cents integer not null,
  file_type text not null,          -- 'pdf' | 'epub' | 'mobi' | 'skill' | 'zip'
  storage_path text not null,       -- cesta v bucketi "digital-products"
  cover_image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists digital_product_purchases (
  id bigserial primary key,
  product_id bigint not null references digital_products(id),
  buyer_email text not null,
  stripe_session_id text not null unique,
  amount_paid_cents integer not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_digital_product_purchases_email on digital_product_purchases (buyer_email);

-- Pokus o vytvorenie privátneho storage bucketu priamo (Supabase to
-- podporuje aj cez SQL) -- bezpečne preskočí, ak už existuje. Over si
-- výsledok aj v dashboarde (Storage), pre istotu.
insert into storage.buckets (id, name, public)
values ('digital-products', 'digital-products', false)
on conflict (id) do nothing;
