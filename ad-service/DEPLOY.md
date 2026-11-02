# Nasadenie: ad.sptrener.online ako SAMOSTATNÁ appka (vlastný proces, vlastný port)

Toto nahrádza pôvodný prístup z `deploy-patch/` (kde ads bežalo v tom istom
procese ako hlavná appka, rozlíšené len podľa hostname). Teraz je to
skutočne oddelené: `ad-service/` je nová appka s vlastným `server.js`,
vlastným PM2 procesom a vlastným portom (3849). Hlavná appka
(`sptrener.online`) sa zredukuje na registráciu/bannery/platby, ktoré
odteraz bežia mimo nej — jediné čo hlavná appka bude robiť je zobraziť
banner, ktorý si stiahne z `ad.sptrener.online` cez API.

## 0. Záloha (vždy pred zásahom do produkcie)

```bash
mkdir -p /root/backups
tar -czf /root/backups/sptrener-online-PRE-AD-SPLIT-$(date +%Y%m%d-%H%M%S).tar.gz \
  -C /home/jurajkurek-vsp/htdocs sptrener.online
```

## 1. Skopíruj novú appku na server

Vytvor nový priečinok vedľa `sptrener.online` (nie v ňom):

```bash
mkdir -p /home/jurajkurek-vsp/htdocs/ad.sptrener.online
```

Do neho nahraj tieto súbory (z tohto repa, priečinok `ad-service/`):
- `server.js`
- `package.json`
- `public/ads.html`

(Postup nahrania — cez CloudPanel File Manager, alebo `wget` z GitHub raw
URL rovnako ako sme to robili pre `deploy-patch/` — pošli mi vedieť, ktorý
spôsob chceš, a dám ti presné príkazy/URL.)

## 2. Nainštaluj závislosti

```bash
cd /home/jurajkurek-vsp/htdocs/ad.sptrener.online
npm install
```

## 3. `.env` pre novú appku

Appka už nepoužíva Supabase — vlastná registrácia/prihlásenie (email+heslo,
JWT) a MySQL databáza `reklama`. Skopíruj `.env.example` → `.env` a vyplň:

```
PORT=3849
APP_URL=https://ad.sptrener.online
MAIN_APP_ORIGIN=https://sptrener.online
JWT_SECRET=...              # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=reklama
MYSQL_USER=reklama
MYSQL_PASSWORD=...
STRIPE_SECRET_KEY=...       # môže byť rovnaký Stripe účet ako hlavná appka
STRIPE_AD_PRICE_ID=...
STRIPE_VIDEO_AD_PRICE_ID=...
```

## 4. Databázová schéma (MySQL)

```bash
mysql -h 127.0.0.1 -P 3306 -u reklama -p reklama < schema.sql
```

Vytvorí 5 tabuliek (`advertisers`, `ad_banners`, `ad_events`, `video_ads`,
`video_ad_views`). Bezpečné spúšťať opakovane. Nahraté súbory (bannery/videá)
sa ukladajú lokálne do `public/uploads/banners` a `public/uploads/videos` —
tie sa vytvoria automaticky pri štarte appky.

## 5. Nový PM2 proces

```bash
cd /home/jurajkurek-vsp/htdocs/ad.sptrener.online
pm2 start server.js --name sptrener-ads
pm2 save
pm2 logs sptrener-ads --lines 30
```

Over že beží na 3849 a nehlási chyby (chýbajúce env premenné a pod.).

## 6. Vyčisti ads kód z HLAVNEJ appky

Hlavný `server.js` má stále starý patch (AD_HOSTS hostname routing + celý
advertiser/banner/video CRUD/Stripe blok), ktorý je teraz duplicitný a
mŕtvy kód. Odstráň ho spusteným skriptom (bezpečný — robí zálohu, overí
presnú zhodu textu pred zápisom, nič neodstráni "naslepo"):

```bash
cd /home/jurajkurek-vsp/htdocs/sptrener.online
node /root/ad-service/06-remove-ads-from-main-server.js
node -c server.js && echo OK
pm2 restart sptrener
pm2 logs sptrener --lines 30
```

Rewards (`/api/rewards/video-*`) a blog (`/blog`, `/blog/:slug`) v hlavnej
appke **ostávajú bez zmeny** — skript ich zámerne neodstraňuje.

Voliteľné: keďže hlavná appka už neuploaduje bannery/videá, môžeš z jej
`package.json` odstrániť `multer` (`npm uninstall multer`), ak ho
nepoužíva nič iné — over najprv `grep -n "multer" server.js`.

## 7. nginx vhost pre ad.sptrener.online → port 3849

V CloudPanel vytvor nový "Node.js"/reverse-proxy site pre
`ad.sptrener.online`, ktorý smeruje na `127.0.0.1:3849` (NIE na 3848 —
to je hlavná appka). Alebo priamo v nginx config (skopíruj blok
`sptrener.online`, zmeň `server_name` na `ad.sptrener.online` a
`proxy_pass` port na `3849`).

## 8. DNS + SSL

```
ad.sptrener.online  A/CNAME  → rovnaká IP ako sptrener.online
```

```bash
sudo certbot --nginx -d ad.sptrener.online
```

## 9. Widget na hlavnej appke (zobrazenie bannera)

Toto je jediná vec, ktorú hlavná appka (`sptrener.online`) potrebuje navyše
— malý JS snippet v `public/app.html` (alebo `index.html`), ktorý si
stiahne aktívne bannery z `https://ad.sptrener.online/api/ads/serve` (CORS
je už povolené pre `MAIN_APP_ORIGIN`) a zobrazí ich. Toto **ešte nie je
aplikované** — pošli mi výstup:

```bash
grep -n "stats-row" public/app.html
```

a dorobím presný patch (rovnaký opatrný anchor-based prístup ako doteraz),
vrátane klik/impression trackingu smerujúceho na `ad.sptrener.online`.

## 9b. Známy dôsledok migrácie na MySQL

Hlavná appka (produkčný `server.js`) má rewards flow (`/api/rewards/video-*`
— pozri video, získaj +1 test zdarma), ktorý číta `video_ads`/`video_ad_views`
zo **Supabase**. Keďže video reklamy teraz žijú v tejto MySQL databáze
(`reklama`), ten flow ich nenájde, kým sa aj hlavná appka nenaučí čítať z
MySQL. Zatiaľ to nie je viditeľná chyba (v produkcii ešte nie je nahratá
žiadna video reklama), ale treba to doriešiť predtým, než niekto video
reklamu skutočne zaplatí — daj mi vedieť, keď na to prídeme.

## 10. Overenie

```bash
curl -I https://ad.sptrener.online              # 200, servíruje ads.html
curl https://ad.sptrener.online/api/ads/serve    # {"banners":[]}
curl -I https://sptrener.online/blog             # stále funguje, nezmenené
curl https://sptrener.online/api/ads/serve       # teraz by malo vrátiť 404 (route je preč z hlavnej appky)
pm2 status                                       # sptrener aj sptrener-ads obidva "online"
```
