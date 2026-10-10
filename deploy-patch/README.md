# Nasadenie: Blog + Ads platforma + Video rewards na skutočný produkčný server

Tieto súbory sú napísané proti tvojmu **reálnemu** `server.js` (Supabase-natívny,
magic-link auth, email-keyed `users`), nie proti pôvodnému repu sciovsp (ktorý
používal samostatný Postgres/`pg` prístup — to sa v tvojej produkcii nepoužíva).

## 1. Záloha (ak si ju ešte neurobil)

```bash
mkdir -p /root/backups
tar -czf /root/backups/sptrener-online-$(date +%Y%m%d-%H%M%S).tar.gz \
  -C /home/jurajkurek-vsp/htdocs sptrener.online
```

## 2. Nová závislosť

```bash
cd /home/jurajkurek-vsp/htdocs/sptrener.online
npm install multer@^2
```

Nič iné nepribúda — zvyšok (Supabase, Stripe) už máš.

## 3. Databázová schéma + Storage buckety

V Supabase Dashboard → SQL Editor spusti obsah `01-schema.sql` (bezpečné
spúšťať opakovane). Vytvorí 6 nových tabuliek a 2 Storage buckety
(`ad-banners`, `video-ads`, oba verejné na čítanie).

## 4. Environment premenné

Do `.env` pridaj:

```
STRIPE_AD_PRICE_ID=price_...       # vytvor v Stripe: 49€/mesiac recurring
STRIPE_VIDEO_AD_PRICE_ID=price_... # vytvor v Stripe: 149€/mesiac recurring
AD_APP_URL=https://ad.sptrener.online
```

## 5. DNS + SSL pre ad.sptrener.online

U DNS providera: `ad.sptrener.online` → rovnaká IP ako `sptrener.online`.

```bash
sudo certbot --nginx -d ad.sptrener.online
```

nginx config môžeš skopírovať z existujúceho `sptrener.online` bloku, len zmeň
`server_name` na `ad.sptrener.online` — appka si subdoménu rozlišuje sama
(pozri `02-server-routes.js`, MIESTO VLOŽENIA #1).

## 6. Kód

1. Skopíruj `03-ads.html` do `public/ads.html` na serveri.
2. Otvor `server.js` a vlož obsah `02-server-routes.js` na **dve presne
   označené miesta** (pozri komentáre priamo v tom súbore — jedno je hneď
   po `const app = express();`, druhé tesne pred
   `app.get('/:customCode([a-z0-9-]{3,30})', ...)`).
3. `public/app.html` — **toto ešte nemám hotové**, lebo potrebujem vidieť tvoju
   skutočnú `requestTrialSlot()` funkciu (aby som presne vedel, kam vložiť
   ponuku "pozri reklamu za +1 test"). Spusti a pošli mi výstup:

   ```bash
   grep -n "function requestTrialSlot\|async function requestTrialSlot" public/app.html
   # potom (nahraď ČÍSLO riadkom z výstupu vyššie):
   sed -n 'ČÍSLO,+40p' public/app.html
   grep -n "stats-row" public/app.html
   ```

   Pošli mi to a dorobím presný patch pre app.html.

## 7. Reštart a kontrola

```bash
pm2 restart sptrener
pm2 logs sptrener --lines 50
curl -I https://sptrener.online/blog
curl -I https://ad.sptrener.online
```

## Poznámka k bezpečnosti

`SUPABASE_SERVICE_KEY` bol počas ladenia vypísaný do chatu — odporúčam ho
po dokončení nasadenia rotovať cez Supabase Dashboard → Settings → API →
"Reset service_role key" (a aktualizovať `.env`).
