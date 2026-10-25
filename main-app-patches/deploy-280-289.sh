#!/usr/bin/env bash
# Nasadenie patchov 280-289 (bezpečnostné opravy, lacnejšie modely, zdieľaný
# test pool, obchod s digitálnymi produktami) + redesign obchod stránok.
#
# SPUSTI TOTO Z KOREŇA PRODUKČNEJ APPKY NA VPS (tam, kde leží živý server.js
# a kam doteraz chodili všetky main-app-patches/*.js). Over si to pred
# spustením:
#   pwd   # má to byť napr. /home/jurajkurek-vsp/htdocs/sptrener.online
#   ls server.js package.json
#
# Použitie:
#   chmod +x deploy-280-289.sh
#   ./deploy-280-289.sh
#
set -uo pipefail

PATCHES_DIR="main-app-patches"
ALREADY_APPLIED_MARKER="už je aplikované"
PATCHES=(
  "280-auth-gate-open-ai-endpoints.js"
  "281-close-trial-count-bypass.js"
  "282-zebra-mirror-daily-caps.js"
  "283-auth-status-pii-and-misc-hardening.js"
  "284-community-stop-leaking-emails.js"
  "285-marketing-consent-auth-check.js"
  "286-autoseo-webhook-path-sanitize.js"
  "287-haiku-default-sonnet-for-generation.js"
  "288-shared-test-pool.js"
  "289-mount-digital-shop.js"
)
REQUIRED_NEW_FILES=(
  "routes/shop.js"
  "public/obchod.html"
  "public/obchod-dakujeme.html"
  "public/obchod-admin.html"
  "emails/digital-product-purchased.html"
  "db/migrate_zebra_mirror_daily_caps.sql"
  "db/migrate_generated_test_pool.sql"
  "db/migrate_digital_shop.sql"
)

red()   { echo -e "\033[31m$1\033[0m"; }
green() { echo -e "\033[32m$1\033[0m"; }
yellow(){ echo -e "\033[33m$1\033[0m"; }
bold()  { echo -e "\033[1m$1\033[0m"; }

bold "=== 0) Kontrola, že si v koreni produkčnej appky ==="
if [[ ! -f "server.js" || ! -f "package.json" ]]; then
  red "❌ Tu nevidím server.js ani package.json. Spusti tento skript z koreňa"
  red "   produkčnej appky na VPS (tam, kam doteraz chodili main-app-patches/*.js)."
  exit 1
fi
green "✅ server.js a package.json nájdené v $(pwd)."
echo

bold "=== 1) Kontrola, že nové súbory sú na mieste ==="
missing=0
for f in "${REQUIRED_NEW_FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    red "❌ Chýba: $f"
    missing=1
  fi
done
for p in "${PATCHES[@]}"; do
  if [[ ! -f "$PATCHES_DIR/$p" ]]; then
    red "❌ Chýba patch: $PATCHES_DIR/$p"
    missing=1
  fi
done
if [[ "$missing" -eq 1 ]]; then
  echo
  red "Pred spustením skopíruj chýbajúce súbory z git vetvy"
  red "claude/psychologia-ucm-testy-k30asg (repo jurajkurek25/sciovsp) do tohto"
  red "priečinka na rovnaké relatívne cesty, potom skript spusti znova."
  exit 1
fi
green "✅ Všetky nové súbory aj patche sú na mieste."
echo

bold "=== 2) Databázové migrácie (Supabase SQL Editor) ==="
yellow "Tieto 3 súbory MUSIA byť spustené v Supabase Dashboard → SQL Editor"
yellow "PRED reštartom appky (sú idempotentné — bezpečné spustiť aj opakovane):"
echo "   - db/migrate_zebra_mirror_daily_caps.sql"
echo "   - db/migrate_generated_test_pool.sql"
echo "   - db/migrate_digital_shop.sql   (vytvorí aj privátny bucket 'digital-products')"
echo
read -r -p "Spustil/a si už tieto 3 SQL súbory v Supabase SQL Editore? [y/N] " db_confirm
if [[ "${db_confirm,,}" != "y" ]]; then
  red "❌ Zastavujem. Spusti najprv tie 3 SQL súbory v Supabase, potom skript spusti znova."
  exit 1
fi
echo

bold "=== 3) .env — SHOP_ADMIN_EMAILS ==="
if ! grep -q "^SHOP_ADMIN_EMAILS=" .env 2>/dev/null; then
  yellow "⚠️  V .env chýba SHOP_ADMIN_EMAILS (čiarkou oddelený zoznam emailov,"
  yellow "   ktoré majú prístup do /obchod/admin). Bez neho padne na ADMIN_EMAIL."
  read -r -p "Pokračovať aj tak? [y/N] " env_confirm
  if [[ "${env_confirm,,}" != "y" ]]; then
    exit 1
  fi
else
  green "✅ SHOP_ADMIN_EMAILS je nastavené v .env."
fi
echo

bold "=== 4) Záloha server.js pred patchmi ==="
backup_dir="backups"
mkdir -p "$backup_dir"
backup_file="$backup_dir/server.js.pre-280-289-$(date +%Y%m%d-%H%M%S)"
cp server.js "$backup_file"
green "✅ Záloha: $backup_file"
echo

bold "=== 5) Spúšťam patche 280-289 v poradí ==="
for p in "${PATCHES[@]}"; do
  echo
  echo "--- node $PATCHES_DIR/$p ---"
  output="$(node "$PATCHES_DIR/$p" 2>&1)"
  status=$?
  echo "$output"
  if [[ $status -ne 0 ]]; then
    if echo "$output" | grep -q "$ALREADY_APPLIED_MARKER"; then
      yellow "↷ $p je už aplikovaný, preskakujem."
      continue
    fi
    red "❌ Patch $p zlyhal. Zastavujem — oprav problém a spusti skript znova"
    red "   (predošlé patche v tomto behu už sú aplikované, nebudú sa opakovať)."
    exit 1
  fi
  green "✅ $p hotovo."
done
echo
green "✅ Všetky patche prešli (alebo už boli aplikované)."
echo

bold "=== 6) Reštart appky ==="
pm2_name=""
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe sptrener-main >/dev/null 2>&1; then
    pm2_name="sptrener-main"
  elif pm2 describe sptrener >/dev/null 2>&1; then
    pm2_name="sptrener"
  fi
fi
if [[ -n "$pm2_name" ]]; then
  pm2 restart "$pm2_name"
  green "✅ pm2 restart $pm2_name"
else
  yellow "⚠️  Nenašiel som bežiaci pm2 proces 'sptrener-main' ani 'sptrener'."
  yellow "   Reštartuj appku manuálne: pm2 restart <meno-tvojho-procesu>"
  pm2 list 2>/dev/null || true
fi
echo

bold "=== 7) Rýchly smoke test ==="
sleep 2
for path in "/obchod" "/obchod/dakujeme" "/obchod/admin" "/api/shop/products"; do
  code="$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT:-3848}${path}" 2>/dev/null || echo "???")"
  if [[ "$code" == "200" ]]; then
    green "✅ $path → $code"
  else
    yellow "⚠️  $path → $code (over pm2 logs, ak to nie je 200)"
  fi
done

echo
bold "=== Hotovo ==="
echo "Over naživo:"
echo "  pm2 logs ${pm2_name:-<meno-procesu>} --lines 50"
echo "  curl -I https://sptrener.online/obchod"
echo "Prihlás sa na https://sptrener.online/obchod/admin cez Google a over, že"
echo "tvoj email (zo SHOP_ADMIN_EMAILS) má prístup, potom pridaj prvý produkt."
echo "Over aj celý platobný flow jedným testovacím nákupom."
