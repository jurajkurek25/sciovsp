# VSP Tréner SaaS — Nasadenie na VPS

## Požiadavky
- Ubuntu 22.04 VPS (napr. Hetzner CX21 ~5€/mes)
- Node.js 20+
- PostgreSQL 15+
- nginx
- PM2

---

## 1. Inštalácia závislostí na VPS

```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt install postgresql postgresql-contrib -y
sudo systemctl start postgresql

# PM2 (process manager)
sudo npm install -g pm2

# nginx
sudo apt install nginx -y
```

---

## 2. Databáza

```bash
sudo -u postgres psql
CREATE DATABASE vsp_trainer;
CREATE USER vsp_user WITH PASSWORD 'tvoje_heslo';
GRANT ALL PRIVILEGES ON DATABASE vsp_trainer TO vsp_user;
\q

# Inicializácia schémy
psql postgresql://vsp_user:tvoje_heslo@localhost:5432/vsp_trainer -f db/schema.sql
```

---

## 3. Projekt

```bash
# Naklonuj / nahraj projekt
cd /var/www
git clone https://github.com/tvoj-repo/vsp-trainer.git
cd vsp-trainer

# Inštalácia npm packages
npm install

# Konfiguruj .env
cp .env.example .env
nano .env   # Vyplň všetky hodnoty!
```

---

## 4. Stripe nastavenie

1. Vytvor účet na [dashboard.stripe.com](https://dashboard.stripe.com)
2. Vytvor produkt: **VSP Tréner Pro** → cena **4,99 €/mesiac** (recurring)
3. Skopíruj **Price ID** (`price_...`) do `.env` ako `STRIPE_PRICE_ID`
4. API kľúče → skopíruj **Secret key** do `STRIPE_SECRET_KEY`
5. Webhooks → pridaj endpoint: `https://tvoja-domena.sk/api/stripe/webhook`
   - Eventy: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
   - Skopíruj **Webhook signing secret** do `STRIPE_WEBHOOK_SECRET`

---

## 5. Anthropic API

1. [console.anthropic.com](https://console.anthropic.com) → API Keys
2. Vytvor nový kľúč → skopíruj do `ANTHROPIC_API_KEY`

---

## 6. Spustenie servera

```bash
# Spusti s PM2
pm2 start server.js --name vsp-trainer
pm2 save
pm2 startup

# Sledovanie logov
pm2 logs vsp-trainer
```

---

## 7. nginx konfigurácia

```nginx
# /etc/nginx/sites-available/vsp-trainer
server {
    listen 80;
    server_name tvoja-domena.sk www.tvoja-domena.sk;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name tvoja-domena.sk www.tvoja-domena.sk;

    ssl_certificate /etc/letsencrypt/live/tvoja-domena.sk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tvoja-domena.sk/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# Aktivuj
sudo ln -s /etc/nginx/sites-available/vsp-trainer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL (Let's Encrypt)
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d tvoja-domena.sk -d www.tvoja-domena.sk
```

---

## 8. Pridaj `<script>` do index.html

Pred `</body>` v `public/index.html` pridaj:
```html
<script src="/app.js"></script>
```

---

## Ceny & plán

| Plán | Cena | Funkcie |
|------|------|---------|
| Free | 0 € | 33 zabudovaných úloh, localStorage história |
| Pro | 4,99 €/mes | AI generátor úloh, cloud história, všetky okruhy |

---

## Odhadované mesačné náklady

| Položka | Cena |
|---------|------|
| Hetzner VPS CX21 | ~5 €/mes |
| Claude API (100 gen.) | ~2-5 €/mes |
| Stripe fees (~3.4%+0.25€) | variabilné |
| **Celkom** | ~10 € + Stripe |

**Break-even: 3 platiacich používateľov**

---

## API endpointy

```
POST /api/auth/register      — registrácia
POST /api/auth/login         — prihlásenie  
GET  /api/auth/me            — aktuálny user (JWT)

POST /api/stripe/checkout    — vytvor platobný link (JWT)
POST /api/stripe/portal      — zákaznícky portál (JWT)
GET  /api/stripe/status      — stav predplatného (JWT)
POST /api/stripe/webhook     — Stripe eventy (raw body)

POST /api/ai/generate        — generuj úlohy cez Claude (JWT + Pro)
GET  /api/ai/questions       — načítaj uložené AI úlohy (JWT + Pro)
POST /api/ai/save-result     — ulož výsledok testu (JWT)
GET  /api/ai/history         — história testov z DB (JWT)

GET  /api/health             — health check
```
