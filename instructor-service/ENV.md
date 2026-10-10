# instructor-service — premenné prostredia

Nasadzuje sa samostatne ako `instructor.sptrener.online`, rovnaký princíp
ako `dash-service` a `ad-subdomain-service`. Zdieľa Supabase projekt
s hlavnou appkou (žiadna vlastná databáza) — inštruktori sú len ďalšia
rola nad tými istými `courses`/`course_lessons`/`course_purchases`
tabuľkami, ktoré používa aj dash-service.

## Hlavná appka (sptrener.online) — Supabase

- `MAIN_SUPABASE_URL` — rovnaká hodnota ako `SUPABASE_URL` v `.env` hlavnej appky
- `MAIN_SUPABASE_SERVICE_KEY` — rovnaká hodnota ako `SUPABASE_SERVICE_KEY` v `.env` hlavnej appky

## Port

- `INSTRUCTOR_PORT` — default `4100`

## Migrácie pred nasadením

1. `db/add_instructor_platform.sql` v Supabase SQL editore (hlavný projekt) —
   vytvorí `instructors`, `instructor_payouts`, pridá `instructor_id` /
   `platform_cut_percent` / `referral_cut_percent` / `submitted_for_review`
   na `courses` a `instructor_id` / `instructor_share_cents` /
   `via_instructor_referral` / `instructor_payout_id` na `course_purchases`.
2. V Supabase dashboarde (Storage) vytvoriť **Public** bucket `course-content`
   (rovnaký projekt ako `submissions`, ale na rozdiel od neho verejný — video
   aj obrázky kurzu musia byť prehrateľné bez podpísaného odkazu).
3. `npm install` v `instructor-service/`
4. Nastaviť `.env` podľa vyššie, spustiť cez PM2 (rovnaký princíp ako dash):
   `pm2 start server.js --name sptrener-instructor`
5. Nasmerovať `instructor.sptrener.online` na tento proces (reverse proxy /
   CloudPanel vhost, rovnako ako `dash.sptrener.online`).

## Upload videí/obrázkov/PDF

Inštruktor nahráva súbor priamo (nie URL) — `routes/upload.js` ho
streamuje cez `multer` (dočasný súbor na disku) do bucketu
`course-content` a späť vráti verejnú URL, ktorá sa uloží do existujúceho
`video_url`/`cover_image_url`/`doc_url` textového stĺpca (žiadna zmena
schémy netreba). Limity: video 300 MB, obrázok 15 MB, PDF 25 MB — appka
beží na 2 GB RAM VPS, takže aj keď sa súbor pred uploadom číta ako
Buffer (kvôli spoľahlivosti so Supabase SDK), video limit je zámerne
konzervatívnejší ako pri čistom streamingu.

## Prihlásenie inštruktorov

Google OAuth cez rovnaký Supabase projekt ako hlavná appka (rovnaký
`SUPABASE_URL`/anon key ako v `kurz-watch.html`). Prvé prihlásenie
automaticky založí riadok v `instructors` — samotná registrácia je teda
voľná. Kurz sa ale nezobrazí na predaj (`published`), kým ho v dashi
neschváli Juraj — inštruktor si ho vie len označiť ako
`submitted_for_review`.

## Čo ešte chýba (nasleduje v ďalších fázach)

- Prepojenie referral odkazu (`?ref=KOD` na `/kurzy/:slug`) do checkoutu
  hlavnej appky, aby sa `via_instructor_referral`/`referral_cut_percent`
  reálne uplatnili pri kúpe.
- Dash: schvaľovanie inštruktorov/kurzov, nastavenie `platform_cut_percent`,
  prepis ceny kurzu, výplaty cez rovnaký PAY by square mechanizmus ako
  `routes/payouts.js` (len nad `instructors`/`instructor_payouts`).

## Bezpečnostný dizajn

- Service-role kľúč (`MAIN_SUPABASE_SERVICE_KEY`) obchádza RLS — všetky
  endpointy preto vždy overujú `courses.instructor_id === req.instructor.id`
  pred akýmkoľvek čítaním/zápisom (pozri `ownCourseOr404` v `routes/courses.js`).
- Výplaty: rovnaký princíp ako affil partneri — tento kód nikdy neiniciuje
  bankový prevod, len eviduje žiadosť (`instructor_payouts`, status
  `pending`). Skutočný prevod potvrdzuje Juraj sám vo vlastnej bankovej
  appke cez dash.
