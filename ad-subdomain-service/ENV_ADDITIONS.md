# Nové .env premenné pre ad.sptrener.online (appka pod /home/sptrener-ad/htdocs/ad.sptrener.online)

Pridaj do `.env` tejto appky (existujúci `ANTHROPIC_API_KEY` už tam je, používa ho `moderation.js`, netreba nič meniť):

```
# Zdieľané tajomstvo s hlavnou appkou (sptrener.online), aby mohla táto appka
# po zaplatení automaticky publikovať PR články na jej blog. Musí byť
# PRESNE ROVNAKÁ hodnota ako INTERNAL_API_SECRET v .env hlavnej appky
# (/home/jurajkurek-vsp/htdocs/sptrener.online/.env).
INTERNAL_API_SECRET=

# Voliteľné — len ak by hlavná appka mala inú URL než https://sptrener.online
# (predvolená hodnota v kóde, netreba nastavovať, ak je to táto istá).
# MAIN_APP_URL=https://sptrener.online
```

Vygeneruj hodnotu pre `INTERNAL_API_SECRET` (a použi TÚ ISTÚ v oboch appkách):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Stripe: nový typ platby (PR článok) používa `mode: 'payment'` s `price_data` priamo v kóde (nie vopred vytvorený Price ID) — žiadnu novú Stripe Dashboard konfiguráciu netreba, funguje s existujúcim `STRIPE_SECRET_KEY`.

## Automatizovaná starostlivosť o reklamných partnerov (automation.js)

Pridaj do `.env`:

```
# Chráni POST /api/admin/cron/daily a GET/POST /api/admin/flags* — posielaj
# ako hlavičku x-admin-key. Vygeneruj náhodnú hodnotu, napr.:
#   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
ADMIN_KEY=

# Kam chodia emaily o automaticky odhalených rizikových signáloch
# (opakované zamietnutia obsahu). Ak sa nenastaví, notifyAdminFraudFlag sa
# len zaloguje a email sa neposlie.
ADMIN_EMAIL=
```

Denná údržba sa nespúšťa sama — treba na `POST /api/admin/cron/daily` (s hlavičkou `x-admin-key`) nastaviť externý cron (odporúčané raz denne, napr. o 8:00).
