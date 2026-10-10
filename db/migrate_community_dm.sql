-- Súkromné 1:1 správy medzi členmi komunity (routes/community.js). Obsah
-- konverzácie je ÚPLNE súkromný — dash-service (admin panel) k nemu nemá
-- prístup vôbec. Jediná forma moderácie je nahlásenie: keď niekto nahlási
-- konverzáciu, AI (Claude) posúdi poslednú históriu správ a buď nahláseného
-- zablokuje (rovnaké users.community_banned_at pole ako manuálny ban), alebo
-- vyhodnotí nahlásenie ako neopodstatnené. Verdikt + krátke zdôvodnenie sa
-- ukladá pre audit stopu (bez tela správ), ale samotný obsah konverzácie sa
-- NIKDY neukladá nikde inde ako v community_messages a nikdy sa nevystavuje
-- cez žiadny dash-service endpoint.

create table if not exists public.community_conversations (
  id bigserial primary key,
  user_a text not null,
  user_b text not null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint community_conversations_unique unique (user_a, user_b),
  constraint community_conversations_ordered check (user_a < user_b)
);

create table if not exists public.community_messages (
  id bigserial primary key,
  conversation_id bigint not null references public.community_conversations(id) on delete cascade,
  sender_email text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists community_messages_conv_idx on public.community_messages (conversation_id, created_at);

-- Audit stopa AI rozhodnutí o nahláseniach — verdikt a krátke zdôvodnenie,
-- NIKDY telo správ. Toto je jediné, čo môže byť (voliteľne) viditeľné v
-- dash-service pre prehľad, koľko nahlásení prišlo a s akým výsledkom.
create table if not exists public.community_message_reports (
  id bigserial primary key,
  conversation_id bigint not null references public.community_conversations(id) on delete cascade,
  reporter_email text not null,
  reported_email text not null,
  ai_verdict text not null,
  ai_reasoning text,
  created_at timestamptz not null default now()
);
create index if not exists community_message_reports_created_idx on public.community_message_reports (created_at desc);
