// Email sequence for /kam-na-vysoku leads (career_quiz_results).
// Mirrors the pattern already established by 88-webinar-email-automation.js
// (internal setInterval loop, no external cron) but kept fully self-contained
// with uniquely-named locals — does NOT assume 88 has been applied, so it
// works whether or not the webinar automation is deployed yet.
//
// Stages (email_sequence_stage):
//   0 -> 1  immediately: the quiz result itself
//   1 -> 2  +2 days:     branch on is_premium — appreciation (premium) or a
//                        field-specific prep tip (not premium)
//   2 -> 3  +1 day (day 3): ONLY if still not premium — time-limited
//                        discount, deadline = 23:59:59 of the send day,
//                        server-validated (not client-trusted) via a token
//   3 -> 4  +1 day (day 4): ONLY if still not premium — post-offer nurture,
//                        no more discount. Sequence ends here either way.
//
// Requires: db/career_quiz_email_sequence.sql already run, and
// emails/quiz-shell.html present next to server.js.
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('sendPendingQuizEmails')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const NEW_BLOCK = `app.get('/kam-na-vysokou', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'kam-na-vysoku.html')); });

// ── /kam-na-vysoku email sequence ───────────────────────────────────────
const { sendMail: sendQuizMail } = require('./mailer');

function loadQuizEmailTemplate() {
  return require('fs').readFileSync(require('path').join(__dirname, 'emails', 'quiz-shell.html'), 'utf8');
}
function fillQuizTemplate(html, vars) {
  let out = html;
  for (const key of Object.keys(vars)) {
    out = out.split('[' + key + ']').join(vars[key] == null ? '' : String(vars[key]));
  }
  return out;
}
async function isQuizLeadPremium(email) {
  try {
    const { data } = await supabase.from('users').select('is_premium').eq('email', email).maybeSingle();
    return !!(data && data.is_premium);
  } catch (e) { return false; }
}

const QUIZ_APP_CAT = { vsp: 'vsp', psych: 'psych', law: 'law', medicina: 'medicina', technika: 'technika', pedagogika: 'pedagogika', ekonomia: 'vsp', humanitne: 'vsp', umenie: 'vsp' };

const QUIZ_FIELD_TIPS = {
  vsp: { sk: 'Väčšina uchádzačov na spoločenskovedné a všeobecné odbory podceňuje jednu vec: rýchlosť čítania s porozumením pod časovým tlakom. Nie je to o tom, koľko toho vieš, ale ako rýchlo vieš spracovať nový text a nájsť v ňom to podstatné.', cs: 'Většina uchazečů na společenskovědní a všeobecné obory podceňuje jednu věc: rychlost čtení s porozuměním pod časovým tlakem. Není to o tom, kolik toho víš, ale jak rychle umíš zpracovat nový text a najít v něm to podstatné.' },
  psych: { sk: 'Prijímačky na psychológiu nie sú len o všeobecných predpokladoch — testujú aj konkrétne psychologické pojmy a teórie. Kto si myslí, že mu stačí "rozumieť ľuďom", sa často prekvapí, koľko faktografie sa oplatí vedieť naspamäť.', cs: 'Přijímačky na psychologii nejsou jen o všeobecných předpokladech — testují i konkrétní psychologické pojmy a teorie. Kdo si myslí, že mu stačí "rozumět lidem", se často překvapí, kolik faktografie se vyplatí umět nazpaměť.' },
  law: { sk: 'Na práve rozhoduje, ako rýchlo vieš analyzovať dlhý text a nájsť v ňom logickú chybu alebo nesúlad. Kto sa pripravuje len "všeobecne", často podcení práve tréning presnej analytickej časti.', cs: 'U práva rozhoduje, jak rychle umíš analyzovat dlouhý text a najít v něm logickou chybu nebo nesoulad. Kdo se připravuje jen "všeobecně", často podcení právě trénink přesné analytické části.' },
  medicina: { sk: 'Biológia a chémia na prijímačkách na medicínu sa pýtajú do hĺbky, akú stredná škola bežne nepokryje. Kto začne trénovať konkrétne typy úloh až tesne pred termínom, väčšinou stráca zbytočne veľa bodov na začiatočníckych chybách.', cs: 'Biologie a chemie u přijímaček na medicínu se ptají do hloubky, jakou střední škola běžně nepokryje. Kdo začne trénovat konkrétní typy úloh až těsně před termínem, obvykle ztrácí zbytečně moc bodů na začátečnických chybách.' },
  technika: { sk: 'Matematické a logické úlohy na technických a IT odboroch majú svoj typický formát, ktorý sa dá natrénovať — nie je to o tom, či si "dobrý na matiku", ale či poznáš presne tie typy úloh, čo sa opakujú.', cs: 'Matematické a logické úlohy na technických a IT oborech mají svůj typický formát, který se dá natrénovat — není to o tom, jestli jsi "dobrý na matiku", ale jestli znáš přesně ty typy úloh, co se opakují.' },
  pedagogika: { sk: 'Pedagogické fakulty okrem vedomostí testujú aj to, ako vieš argumentovať a reflektovať vlastné skúsenosti pri pohovore. Kto sa pripraví len na písomku a zabudne na pohovor, sa často zbytočne pripraví o body na poslednej rovinke.', cs: 'Pedagogické fakulty kromě znalostí testují i to, jak umíš argumentovat a reflektovat vlastní zkušenosti u pohovoru. Kdo se připraví jen na písemku a zapomene na pohovor, se často zbytečně připraví o body na poslední rovince.' },
  ekonomia: { sk: 'Na ekonomických odboroch rozhoduje kombinácia všeobecných predpokladov a základnej matematiky. Kto trénuje len jedno z toho, má v teste zbytočnú medzeru presne tam, kde ju netuší.', cs: 'Na ekonomických oborech rozhoduje kombinace všeobecných předpokladů a základní matematiky. Kdo trénuje jen jedno z toho, má v testu zbytečnou mezeru přesně tam, kde ji netuší.' },
  humanitne: { sk: 'Humanitné odbory bývajú prekvapivo náročné na rýchlosť čítania a analýzu dlhších textov — nie je to len o všeobecnom prehľade, ale o tom, ako rýchlo vieš spracovať nový text pod tlakom.', cs: 'Humanitní obory bývají překvapivě náročné na rychlost čtení a analýzu delších textů — není to jen o všeobecném přehledu, ale o tom, jak rychle umíš zpracovat nový text pod tlakem.' },
  umenie: { sk: 'Aj na umeleckých a dizajnérskych odboroch, kde rozhoduje najmä talentová skúška, mnohé školy vyžadujú aj základný všeobecný test — kto naň zabudne pripraviť, sa nechá zbytočne zaskočiť.', cs: 'I na uměleckých a designérských oborech, kde rozhoduje hlavně talentová zkouška, mnohé školy vyžadují i základní všeobecný test — kdo na něj zapomene připravit, se nechá zbytočně zaskočit.' }
};

function quizStage1Content(lead, lang) {
  const appCat = QUIZ_APP_CAT[lead.top_field] || 'vsp';
  const isCs = lang === 'cs';
  return {
    subject: (isCs ? 'Tvůj výsledek: ' : 'Tvoj výsledok: ') + (lead.top_field_name || ''),
    eyebrow: isCs ? '🎓 Tvůj výsledek' : '🎓 Tvoj výsledok',
    title: isCs ? ('Sedí ti ' + (lead.top_field_name || '') + '.') : ('Sedí ti ' + (lead.top_field_name || '') + '.'),
    bodyHtml: '<p style="margin:0 0 14px;">' + (lead.top_field_desc || '') + '</p><p style="margin:0;">' + (isCs ? 'Chceš vědět víc o konkrétních školách, které ti sedí? Otevři si svůj výsledek znovu na webu — je uložený pod tvým Google účtem.' : 'Chceš vedieť viac o konkrétnych školách, ktoré ti sedia? Otvor si svoj výsledok znova na webe — je uložený pod tvojím Google účtom.') + '</p>',
    ctaUrl: APP_URL + '/app?cat=' + appCat + '&upgrade=free',
    ctaText: isCs ? 'Zkus to zdarma →' : 'Skús to zadarmo →',
    footerNote: ''
  };
}
function quizStage2PremiumContent(lang) {
  const isCs = lang === 'cs';
  return {
    subject: isCs ? 'Jak ti to jde?' : 'Ako ti to ide?',
    eyebrow: isCs ? '💪 Držíme ti palce' : '💪 Držíme ti palce',
    title: isCs ? 'Jak ti to jde s přípravou?' : 'Ako ti to ide s prípravou?',
    bodyHtml: '<p style="margin:0;">' + (isCs ? 'Jen krátká připomínka, že ti to tu držíme palce. Pokud narazíš na téma, ve kterém pořád děláš chyby, AI generátor testů to sleduje a přizpůsobí ti další úlohy přesně na to.' : 'Len krátka pripomienka, že ti to tu držíme palce. Ak narazíš na tému, v ktorej stále robíš chyby, AI generátor testov to sleduje a prispôsobí ti ďalšie úlohy presne na to.') + '</p>',
    ctaUrl: APP_URL + '/app',
    ctaText: isCs ? 'Pokračovat v přípravě →' : 'Pokračovať v príprave →',
    footerNote: ''
  };
}
function quizStage2Content(lead, lang) {
  const isCs = lang === 'cs';
  const appCat = QUIZ_APP_CAT[lead.top_field] || 'vsp';
  const tip = (QUIZ_FIELD_TIPS[lead.top_field] && QUIZ_FIELD_TIPS[lead.top_field][lang]) || '';
  return {
    subject: isCs ? ('3 věci, které většina uchazečů na ' + (lead.top_field_name || '') + ' podcení') : ('3 veci, ktoré väčšina uchádzačov na ' + (lead.top_field_name || '') + ' podcení'),
    eyebrow: isCs ? '📚 Tip na přípravu' : '📚 Tip na prípravu',
    title: isCs ? 'Tohle většina lidí při přípravě podcení' : 'Toto väčšina ľudí pri príprave podcení',
    bodyHtml: '<p style="margin:0 0 14px;">' + tip + '</p><p style="margin:0;">' + (isCs ? 'Přesně na tohle je SP Tréner postavený — AI generátor testů, který se přizpůsobí tomu, v čem děláš chyby.' : 'Presne na toto je SP Tréner postavený — AI generátor testov, ktorý sa prispôsobí tomu, v čom robíš chyby.') + '</p>',
    ctaUrl: APP_URL + '/app?cat=' + appCat + '&upgrade=free',
    ctaText: isCs ? 'Vyzkoušej přípravu zdarma →' : 'Vyskúšaj prípravu zadarmo →',
    footerNote: ''
  };
}
function quizStage3Content(lead, lang, offerUrl, deadlineLabel) {
  const isCs = lang === 'cs';
  return {
    subject: isCs ? 'Tvá sleva končí dnes o půlnoci ⏳' : 'Tvoja zľava končí dnes o polnoci ⏳',
    eyebrow: isCs ? '⏳ Nabídka jen dnes' : '⏳ Ponuka len dnes',
    title: isCs ? 'Tohle dneska ještě stihneš.' : 'Toto dnes ešte stihneš.',
    bodyHtml: '<p style="margin:0 0 14px;">' + (isCs ? 'Protože ses zúčastnil/a testu odboru, máš dnes výjimečně zvýhodněnou cenu na Premium i Elite členství SP Tréner — platí jen do ' + deadlineLabel + '.' : 'Keďže si sa zúčastnil/a testu odboru, máš dnes výnimočne zvýhodnenú cenu na Premium aj Elite členstvo SP Tréner — platí len do ' + deadlineLabel + '.') + '</p><p style="margin:0;">' + (isCs ? 'Po půlnoci se nabídka vrací na běžnou cenu — bez naštvání, prostě to tak funguje u časově omezených akcí.' : 'Po polnoci sa ponuka vracia na bežnú cenu — bez nahnevania, jednoducho to tak funguje pri časovo obmedzených akciách.') + '</p>',
    ctaUrl: offerUrl,
    ctaText: isCs ? 'Získat slevu →' : 'Získať zľavu →',
    footerNote: isCs ? 'Nabídka platí jen do ' + deadlineLabel + '.' : 'Ponuka platí len do ' + deadlineLabel + '.'
  };
}
function quizStage4Content(lead, lang) {
  const isCs = lang === 'cs';
  const appCat = QUIZ_APP_CAT[lead.top_field] || 'vsp';
  return {
    subject: isCs ? 'Sleva skončila, ale tohle pořád platí' : 'Zľava skončila, ale toto stále platí',
    eyebrow: isCs ? '📌 Stále aktuální' : '📌 Stále aktuálne',
    title: isCs ? 'Sleva skončila, ale příprava nikam neuteče' : 'Zľava skončila, ale príprava nikam neuteká',
    bodyHtml: '<p style="margin:0;">' + (isCs ? 'Zvýhodněná cena z tvého testu už bohužel vypršela, ale SP Tréner je tu pro tebe za běžnou cenu kdykoliv budeš chtít začít.' : 'Zvýhodnená cena z tvojho testu už žiaľ vypršala, ale SP Tréner je tu pre teba za bežnú cenu kedykoľvek budeš chcieť začať.') + '</p>',
    ctaUrl: APP_URL + '/app?cat=' + appCat,
    ctaText: isCs ? 'Podívat se na SP Tréner →' : 'Pozrieť si SP Tréner →',
    footerNote: ''
  };
}

async function sendQuizStageEmail(lead, content) {
  const shell = loadQuizEmailTemplate();
  const html = fillQuizTemplate(shell, {
    PREHEADER: content.subject,
    EYEBROW: content.eyebrow,
    TITLE: content.title,
    BODY_HTML: content.bodyHtml,
    CTA_URL: content.ctaUrl,
    CTA_TEXT: content.ctaText,
    FOOTER_NOTE: content.footerNote,
    UNSUBSCRIBE: APP_URL + '/api/kam-na-vysoku/unsubscribe?id=' + lead.id
  });
  await sendQuizMail({ to: lead.email, subject: content.subject, html });
}

async function sendPendingQuizEmails() {
  try {
    const now = new Date();
    const { data: due } = await supabase.from('career_quiz_results').select('*')
      .eq('marketing_consent', true)
      .lt('email_sequence_stage', 4)
      .lte('next_email_due_at', now.toISOString())
      .limit(50);

    for (const lead of due || []) {
      const lang = lead.lang === 'cs' ? 'cs' : 'sk';
      const stage = lead.email_sequence_stage;

      if (stage === 0) {
        await sendQuizStageEmail(lead, quizStage1Content(lead, lang));
        await supabase.from('career_quiz_results').update({
          email_sequence_stage: 1,
          next_email_due_at: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString()
        }).eq('id', lead.id);
        continue;
      }

      if (stage === 1) {
        const premium = await isQuizLeadPremium(lead.email);
        if (premium) {
          await sendQuizStageEmail(lead, quizStage2PremiumContent(lang));
          // Uz plati — dalsia zlava by nedavala zmysel, sekvencia tu konci.
          await supabase.from('career_quiz_results').update({
            email_sequence_stage: 4, converted_premium_at: now.toISOString()
          }).eq('id', lead.id);
        } else {
          await sendQuizStageEmail(lead, quizStage2Content(lead, lang));
          await supabase.from('career_quiz_results').update({
            email_sequence_stage: 2,
            next_email_due_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
          }).eq('id', lead.id);
        }
        continue;
      }

      if (stage === 2) {
        const premium = await isQuizLeadPremium(lead.email);
        if (premium) {
          await supabase.from('career_quiz_results').update({ email_sequence_stage: 4, converted_premium_at: now.toISOString() }).eq('id', lead.id);
          continue;
        }
        const token = require('crypto').randomBytes(24).toString('hex');
        const deadline = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const offerUrl = APP_URL + '/ponuka?src=quiz&token=' + token;
        const deadlineLabel = (lang === 'cs' ? '23:59 dnes' : '23:59 dnes');
        await sendQuizStageEmail(lead, quizStage3Content(lead, lang, offerUrl, deadlineLabel));
        await supabase.from('career_quiz_results').update({
          email_sequence_stage: 3,
          discount_token: token,
          discount_deadline: deadline.toISOString(),
          next_email_due_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
        }).eq('id', lead.id);
        continue;
      }

      if (stage === 3) {
        const premium = await isQuizLeadPremium(lead.email);
        if (!premium) {
          await sendQuizStageEmail(lead, quizStage4Content(lead, lang));
        }
        await supabase.from('career_quiz_results').update({
          email_sequence_stage: 4,
          converted_premium_at: premium ? now.toISOString() : null
        }).eq('id', lead.id);
        continue;
      }
    }
  } catch (e) {
    console.error('sendPendingQuizEmails error:', e.message);
  }
}
setInterval(sendPendingQuizEmails, 5 * 60 * 1000);
sendPendingQuizEmails();

app.get('/api/kam-na-vysoku/unsubscribe', async (req, res) => {
  const id = (req.query.id || '').toString();
  if (id) await supabase.from('career_quiz_results').update({ marketing_consent: false }).eq('id', id);
  res.set('Content-Type', 'text/html; charset=utf-8').send('<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;"><h2>Odhlásené</h2><p>Už ti nebudeme posielať e-maily súvisiace s testom odboru.</p></body>');
});`;

const patched = replaceOnce(src, "app.get('/kam-na-vysokou', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'kam-na-vysoku.html')); });", NEW_BLOCK, "/kam-na-vysokou anchor");

const backup = FILE + '.pre-quiz-email-sequence-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Over, ze db/career_quiz_email_sequence.sql uz bezal a emails/quiz-shell.html existuje.');
