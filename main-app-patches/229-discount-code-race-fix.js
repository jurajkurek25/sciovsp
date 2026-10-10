// Bezpečnostná oprava: course_discount_codes.max_uses sa kontroloval len
// raz pri vytvorení checkout session (used_count < max_uses) -- samotný
// zápis used_count+1 prebiehal AŽ NESKÔR, asynchrónne, vo webhooku, bez
// zámku. Pri dvoch súbežných checkoutoch na kóde s posledným voľným
// použitím mohli obaja prejsť kontrolou skôr, než sa čokoľvek zapísalo ->
// kód sa dal použiť viackrát, než mal (zľava navyše, strata na tržbách).
//
// Oprava:
// 1) Pri vytvorení checkout session sa použitie REZERVUJE HNEĎ atomicky
//    (compare-and-swap na used_count: UPDATE ... WHERE id=? AND
//    used_count=?). Ak CAS neuspeje (0 riadkov), niekto iný práve zobral
//    posledné voľné použitie -- vrátime rovnakú chybu ako pri expirovanom
//    kóde, namiesto vytvorenia checkoutu.
// 2) Vo webhooku sa teraz used_count UŽ NEINKREMENTUJE (bolo by to
//    duplicitné počítanie -- rezervácia prebehla skôr, v bode 1).
//
// Pozn. k trade-off: ak klient checkout session NEDOKONČÍ (opustí pred
// zaplatením), rezervované použitie sa už nevráti späť -- kód môže
// "minúť" použitie na nedokončenú platbu. To je bezpečná strana chyby
// (nikdy nepustí viac, než má) a dá sa doriešiť samostatne cez
// checkout.session.expired webhook, ak by to vadilo v praxi.
//
// Kotvy sú byte-presne overené z tvojho výstupu main-app-patches/228.
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/229-discount-code-race-fix.js
// Potom: pm2 restart <meno procesu hlavnej appky>

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som server.js — spusti z koreňa hlavnej appky.');
  process.exit(1);
}
let src = fs.readFileSync(SERVER_PATH, 'utf8');

if (src.includes('discount code race fix')) {
  console.log('ℹ️  Už je aplikované, preskakujem.');
  process.exit(0);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error('❌ ' + label + ' kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, () => newStr);
}

// ── 1) Checkout creation: atomicky rezervuj použitie ──────────────────────
const CHECKOUT_OLD = `    let appliedDiscountCode = null;
    let finalPriceCents = course.price_cents;
    if (discountCode) {
      const { data: dc } = await supabase.from('course_discount_codes').select('*').ilike('code', discountCode).maybeSingle();
      const now = new Date();
      const valid = dc && dc.active && (!dc.course_id || dc.course_id === course.id) && (!dc.expires_at || new Date(dc.expires_at) > now) && (dc.max_uses == null || dc.used_count < dc.max_uses);
      if (!valid) return res.status(400).json({ error: 'Neplatný alebo expirovaný zľavový kód.' });
      appliedDiscountCode = dc.code;
      finalPriceCents = Math.max(50, Math.round(course.price_cents * (100 - dc.percent_off) / 100));
    }`;

const CHECKOUT_NEW = `    let appliedDiscountCode = null;
    let finalPriceCents = course.price_cents;
    if (discountCode) {
      const { data: dc } = await supabase.from('course_discount_codes').select('*').ilike('code', discountCode).maybeSingle();
      const now = new Date();
      const valid = dc && dc.active && (!dc.course_id || dc.course_id === course.id) && (!dc.expires_at || new Date(dc.expires_at) > now) && (dc.max_uses == null || dc.used_count < dc.max_uses);
      if (!valid) return res.status(400).json({ error: 'Neplatný alebo expirovaný zľavový kód.' });
      // discount code race fix: atomicky rezervuj použitie HNEĎ (CAS na
      // used_count) -- inak by dva súbežné checkouty na poslednom voľnom
      // použití mohli oba prejsť kontrolou vyššie.
      if (dc.max_uses != null) {
        const { data: reserved } = await supabase.from('course_discount_codes')
          .update({ used_count: dc.used_count + 1 })
          .eq('id', dc.id).eq('used_count', dc.used_count).select('id');
        if (!reserved || !reserved.length) return res.status(400).json({ error: 'Tento zľavový kód bol práve vyčerpaný, skús to znova.' });
      }
      appliedDiscountCode = dc.code;
      finalPriceCents = Math.max(50, Math.round(course.price_cents * (100 - dc.percent_off) / 100));
    }`;

src = replaceOnce(src, CHECKOUT_OLD, CHECKOUT_NEW, 'checkout discount reservation');

// ── 2) Webhook: odstráň teraz-duplicitný inkrement ─────────────────────────
const WEBHOOK_OLD = `          if (session.metadata.discountCode) {
            (async () => {
              try {
                const { data: dcRow } = await supabase.from('course_discount_codes').select('id, used_count').ilike('code', session.metadata.discountCode).maybeSingle();
                if (dcRow) await supabase.from('course_discount_codes').update({ used_count: dcRow.used_count + 1 }).eq('id', dcRow.id);
              } catch (e) { console.error('discount code usage increment failed:', e.message); }
            })();
          }`;

const WEBHOOK_NEW = `          // discount code race fix: used_count sa už rezervoval atomicky
          // v checkout session-create endpointe, nie tu -- inkrement na
          // tomto mieste by bol duplicitný.`;

src = replaceOnce(src, WEBHOOK_OLD, WEBHOOK_NEW, 'webhook increment removal');

const backup = SERVER_PATH + '.pre-229-discount-code-race-fix-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, src);
console.log('✅ server.js prepísaný (discount code max_uses sa teraz rezervuje atomicky, webhook duplicitný inkrement odstránený). Záloha:', backup);
console.log('');
console.log('Over: node -c server.js');
console.log('Reštart: pm2 restart <meno procesu hlavnej appky>');
