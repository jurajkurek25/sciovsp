// Doplna poznamku "vypis z karty bude NEOWORKLY.COM" do uz EXISTUJUCICH
// potvrdzovacich emailov za nakup (kurz, SP Generalka) -- rovnaka
// poznamka uz je v novych premium-purchased.html / elite-purchased.html
// (main-app-patches/247) aj na webe pred platbou (checkout popup + VOP).
//
// Kotvy overene priamo zo ziveho obsahu (cat emails/course-purchased.html,
// cat emails/generalka-purchased.html).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/248-neoworkly-statement-disclosure-emails.js

const fs = require('fs');
const path = require('path');

const EMAILS_DIR = path.join(process.cwd(), 'emails');
const COURSE_PATH = path.join(EMAILS_DIR, 'course-purchased.html');
const GENERALKA_PATH = path.join(EMAILS_DIR, 'generalka-purchased.html');

if (!fs.existsSync(COURSE_PATH) || !fs.existsSync(GENERALKA_PATH)) {
  console.error('❌ Nenašiel som emails/course-purchased.html alebo emails/generalka-purchased.html — spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.248-neoworkly-statement-disclosure-emails-lock');
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceOnce(src, oldStr, newStr, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== 1) {
    console.error('❌ ' + label + ' — kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.');
    process.exit(1);
  }
  return src.replace(oldStr, () => newStr);
}

const DISCLOSURE = `<p style="margin:14px 0 0;color:rgba(246,241,231,.45);font-size:11px;line-height:1.5;">
ℹ️ Platba sa na výpise z karty alebo bankového účtu zobrazí ako <b>NEOWORKLY.COM</b> — ide o rovnakého prevádzkovateľa platobnej brány, nie o inú firmu.
</p>
`;

// ── course-purchased.html ────────────────────────────────────────────
let course = fs.readFileSync(COURSE_PATH, 'utf8');
if (course.includes('NEOWORKLY.COM')) {
  console.log('ℹ️  course-purchased.html už obsahuje poznámku, preskakujem.');
} else {
  const COURSE_OLD = `<p style="margin:18px 0 0;color:rgba(246,241,231,.4);font-size:12px;line-height:1.5;">
Veľa šťastia a nech sa ti darí!
</p>
<p style="margin:14px 0 0;color:rgba(246,241,231,.4);font-size:12px;line-height:1.5;">
<a href="[UNSUBSCRIBE]" style="color:rgba(246,241,231,.4);">Odhlásiť tieto emaily</a>
</p>`;
  const COURSE_NEW = `<p style="margin:18px 0 0;color:rgba(246,241,231,.4);font-size:12px;line-height:1.5;">
Veľa šťastia a nech sa ti darí!
</p>
${DISCLOSURE}<p style="margin:14px 0 0;color:rgba(246,241,231,.4);font-size:12px;line-height:1.5;">
<a href="[UNSUBSCRIBE]" style="color:rgba(246,241,231,.4);">Odhlásiť tieto emaily</a>
</p>`;
  if (!course.includes(COURSE_OLD)) {
    console.error('❌ Nenašiel som presnú kotvu v course-purchased.html. Nič som nezmenil.');
    process.exit(1);
  }
  course = replaceOnce(course, COURSE_OLD, COURSE_NEW, 'course-purchased.html');
  fs.copyFileSync(COURSE_PATH, COURSE_PATH + '.pre-248-' + Date.now());
  fs.writeFileSync(COURSE_PATH, course);
  console.log('✅ course-purchased.html doplnený.');
}

// ── generalka-purchased.html ─────────────────────────────────────────
let generalka = fs.readFileSync(GENERALKA_PATH, 'utf8');
if (generalka.includes('NEOWORKLY.COM')) {
  console.log('ℹ️  generalka-purchased.html už obsahuje poznámku, preskakujem.');
} else {
  const GEN_OLD = `<p style="margin:18px 0 0;color:rgba(246,241,231,.4);font-size:12px;line-height:1.5;">
Veľa šťastia!
</p>
<p style="margin:14px 0 0;color:rgba(246,241,231,.4);font-size:12px;line-height:1.5;">
<a href="[UNSUBSCRIBE]" style="color:rgba(246,241,231,.4);">Odhlásiť tieto emaily</a>
</p>`;
  const GEN_NEW = `<p style="margin:18px 0 0;color:rgba(246,241,231,.4);font-size:12px;line-height:1.5;">
Veľa šťastia!
</p>
${DISCLOSURE}<p style="margin:14px 0 0;color:rgba(246,241,231,.4);font-size:12px;line-height:1.5;">
<a href="[UNSUBSCRIBE]" style="color:rgba(246,241,231,.4);">Odhlásiť tieto emaily</a>
</p>`;
  if (!generalka.includes(GEN_OLD)) {
    console.error('❌ Nenašiel som presnú kotvu v generalka-purchased.html. Nič som nezmenil.');
    process.exit(1);
  }
  generalka = replaceOnce(generalka, GEN_OLD, GEN_NEW, 'generalka-purchased.html');
  fs.copyFileSync(GENERALKA_PATH, GENERALKA_PATH + '.pre-248-' + Date.now());
  fs.writeFileSync(GENERALKA_PATH, generalka);
  console.log('✅ generalka-purchased.html doplnený.');
}

console.log('Statické súbory — žiadny pm2 restart netreba.');
