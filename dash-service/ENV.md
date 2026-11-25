# dash-service — premenné prostredia

Nasadzuje sa samostatne ako `dash.sptrener.online` (podobne ako
`ad-subdomain-service` beží ako `ad.sptrener.online`). Potrebuje priamy
prístup do všetkých 3 systémov + admin kľúče na volanie ich existujúcich
admin endpointov.

## Autentifikácia (jediný účet — Juraj)

- `DASH_ADMIN_PASSWORD_HASH` — bcrypt hash hesla. Vygeneruj lokálne:
  `node -e "console.log(require('bcryptjs').hashSync('TVOJE_HESLO', 10))"`
- `DASH_BENEFICIARY_NAME` — meno príjemcu, ktoré sa zobrazí v PAY by square QR (default `SP Trener`)

## Hlavná appka (sptrener.online) — Supabase

- `MAIN_SUPABASE_URL` — rovnaká hodnota ako `SUPABASE_URL` v `.env` hlavnej appky
- `MAIN_SUPABASE_SERVICE_KEY` — rovnaká hodnota ako `SUPABASE_SERVICE_KEY` v `.env` hlavnej appky

## Partner appka (partner.sptrener.online) — Supabase

- `PARTNER_SUPABASE_URL`
- `PARTNER_SUPABASE_SERVICE_ROLE_KEY`
- `PARTNER_APP_URL` (default `https://partner.sptrener.online`)
- `PARTNER_ADMIN_KEY` — rovnaká hodnota ako `PARTNER_ADMIN_KEY` v partner repe (posiela sa ako `x-admin-key`)

Poznámka: `dash_*` tabuľky (schema-dash.sql) žijú v partnerskom Supabase projekte.

## Reklamná appka (ad.sptrener.online) — MySQL

- `AD_MYSQL_HOST`, `AD_MYSQL_PORT`, `AD_MYSQL_DATABASE`, `AD_MYSQL_USER`, `AD_MYSQL_PASSWORD`
- `AD_APP_URL` (default `https://ad.sptrener.online`)
- `AD_ADMIN_KEY` — rovnaká hodnota ako `ADMIN_KEY` v ad-subdomain-service (posiela sa ako `x-admin-key`)

## AI (poradca + autonómny aiops)

- `ANTHROPIC_API_KEY`
- `DASH_CRON_KEY` — chráni `POST /api/dash/aiops/cron` (externý denný beh, bez session cookie). Vygeneruj: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`. Bez tohto nastaveného zostáva endpoint natrvalo zamknutý (403).

## Voliteľné prahy pre autonómny aiops

- `DASH_AUTO_PUBLISH_BLOG` — `true`/`false`, default `true`. Ak `false`, AI blog články sa ukladajú ako draft (`published=false`) namiesto priameho publikovania.
- `DASH_PAYOUT_READY_THRESHOLD_EUR` — suma v €, od ktorej aiops automaticky flagne pending výber ako "pripravený na vyplatenie" (default `20`)

## Migrácie pred nasadením

1. `partner` repo → `schema-dash.sql` v Supabase SQL editore (partnerský projekt) — vytvorí `partner_academy_lessons` (+ presunie obsah Akadémie z kódu do DB), `dash_bug_reports`, `dash_ai_actions_log`, `dash_admin_sessions`, `dash_advisor_messages`.
2. Deploy `dash-service/` ako samostatnú appku (rovnaký princíp ako `ad-subdomain-service`) na `dash.sptrener.online`.

## Bezpečnostný dizajn (dôležité)

- Prístup majú len tí, čo poznajú `DASH_ADMIN_PASSWORD_HASH` — žiadna registrácia, žiadny druhý účet.
- Výplaty: `bysquare` iba generuje QR/reťazec s IBAN+sumou. Nikto (ani AI, ani tento kód) nemá prístup k bankovému účtu — prevod vždy manuálne potvrdzuje Juraj vo vlastnej bankovej appke. Označenie "vyplatené" je samostatný krok, ktorý sa dá kliknúť len PO reálnom prevode.
- Každá autonómna AI akcia (blog, payout flagging, ...) sa loguje do `dash_ai_actions_log` s dôvodom (`reasoning`) — nič sa nemaže, len pridáva.
