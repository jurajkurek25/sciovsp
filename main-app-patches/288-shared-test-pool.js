// NÁKLADOVÁ ZÁPLATA — zdieľaný pool vygenerovaných plných testov.
//
// Doteraz každé volanie /api/generate-full-test spustilo 14 paralelných
// Claude API volaní (jedno na okruh), úplne nanovo, pre KAŽDÉHO klienta
// zvlášť -- aj keď dvaja rôzni klienti chceli ten istý jazyk+obtiažnosť.
//
// Táto záplata:
//   1. Pred generovaním skúsi najprv zdieľaný pool (generated_test_pool):
//      ak existuje test pre rovnaký jazyk+obtiažnosť, ktorý TENTO email
//      ešte nevidel (user_seen_tests), pošle mu HO -- žiadne AI volanie.
//      Platí pre VŠETKÝCH (free aj Premium/Elite).
//   2. Ak pool nemá nič vhodné (prázdny, alebo user už videl všetko v
//      ňom), vygeneruje nový test ako doteraz, ULOŽÍ ho do poolu pre
//      budúcich klientov, a zaznačí ho ako videný pre tohto klienta.
//   3. Anonymní klienti (bez emailu) dostanú ľubovoľný test z poolu
//      (nesleduje sa im "videné" -- majú nárok len na jeden bezplatný
//      test bez registrácie celkovo, takže opakovanie v rámci jedného
//      vydania nehrozí).
//
// Zlyhanie poolu (lookup alebo insert) NESMIE zablokovať odpoveď userovi
// -- v oboch prípadoch padne bezpečne na normálne AI generovanie.
//
// Vyžaduje db/migrate_generated_test_pool.sql (uz spustený).
// Vyžaduje main-app-patches/281-close-trial-count-bypass.js (uz aplikovaný
// -- táto záplata nadväzuje na jeho výstup, else-vetvu s trial_count
// kontrolou).
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/288-shared-test-pool.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.288-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceExactCount(s, oldStr, newStr, expectedCount, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== expectedCount) {
    console.error('❌ ' + label + ' — očakávaných ' + expectedCount + ' výskytov, nájdených ' + count + '. Nič som nezmenil.');
    process.exit(1);
  }
  return s.split(oldStr).join(newStr);
}

if (!fs.existsSync(FILE)) {
  console.error('❌ Nenašiel som súbor:', FILE, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('generated_test_pool')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}
if (!src.includes('patch 281')) {
  console.error('❌ server.js: main-app-patches/281-close-trial-count-bypass.js ešte nie je aplikovaný. Spusti ho najprv -- táto záplata nadväzuje na jeho výstup.');
  process.exit(1);
}

// ── 1) Pool lookup -- vlož hneď po trial/premium kontrole, pred generovaním ──
const LOOKUP_OLD = `      if (newTrialCount >= FREE_TESTS) {
        await supabase.from('trial_abuse_signals').update({ exhausted_at: new Date().toISOString() })
          .eq('signal_type', 'email_norm').eq('signal_value', normalizeEmailForAbuseCheck(email));
      }
    }
  }

  try {
    console.log('Generujem celý AI test, obtiažnosť:', difficulty);`;

const LOOKUP_NEW = `      if (newTrialCount >= FREE_TESTS) {
        await supabase.from('trial_abuse_signals').update({ exhausted_at: new Date().toISOString() })
          .eq('signal_type', 'email_norm').eq('signal_value', normalizeEmailForAbuseCheck(email));
      }
    }
  }

  // (patch 288) Zdieľaný pool vygenerovaných testov -- ak existuje test
  // pre tento jazyk+obtiažnosť, ktorý tento email (alebo anonymný
  // návštevník) ešte nevidel, pošli HO namiesto nového AI generovania.
  // Zlyhanie tohto bloku nesmie zablokovať odpoveď -- padni na normálne
  // generovanie nižšie.
  try {
    const { data: poolRows } = await supabase.from('generated_test_pool')
      .select('id, questions, verbal_count, analytical_count')
      .eq('lang', lang).eq('difficulty', difficulty)
      .order('created_at', { ascending: true }).limit(500);
    if (poolRows && poolRows.length) {
      let candidate = null;
      if (email) {
        const poolIds = poolRows.map(p => p.id);
        const { data: seenRows } = await supabase.from('user_seen_tests')
          .select('test_id').eq('email', email).in('test_id', poolIds);
        const seenIds = new Set((seenRows || []).map(s => s.test_id));
        candidate = poolRows.find(p => !seenIds.has(p.id)) || null;
      } else {
        candidate = poolRows[Math.floor(Math.random() * poolRows.length)];
      }
      if (candidate) {
        if (email) {
          await supabase.from('user_seen_tests').upsert(
            { email, test_id: candidate.id },
            { onConflict: 'email,test_id', ignoreDuplicates: true }
          );
        }
        console.log('Test z poolu (id=' + candidate.id + ') namiesto AI generovania -- ' + lang + '/' + difficulty + '.');
        return res.json({
          success: true,
          verbal: candidate.verbal_count,
          analytical: candidate.analytical_count,
          total: candidate.verbal_count + candidate.analytical_count,
          questions: candidate.questions
        });
      }
    }
  } catch (poolErr) {
    console.error('Pool lookup zlyhal, generujem nový test:', poolErr.message);
  }

  try {
    console.log('Generujem celý AI test, obtiažnosť:', difficulty);`;

src = replaceExactCount(src, LOOKUP_OLD, LOOKUP_NEW, 1, 'pool lookup insertion point');

// ── 2) Pool insert -- vlož po úspešnom generovaní, pred odoslaním odpovede ──
const INSERT_OLD = `    const allQuestions = [...verbalQs, ...analyticalQs];

    res.json({
      success: true,
      verbal: verbalQs.length,
      analytical: analyticalQs.length,
      total: allQuestions.length,
      questions: allQuestions
    });

  } catch(err) {
    console.error('Chyba generovania celého testu:', err.message);`;

const INSERT_NEW = `    const allQuestions = [...verbalQs, ...analyticalQs];

    // (patch 288) Ulož do zdieľaného poolu pre budúce požiadavky iných
    // klientov -- zlyhanie tohto zápisu nesmie zablokovať odpoveď
    // TOMUTO userovi, test už má vygenerovaný.
    try {
      const { data: poolInsert } = await supabase.from('generated_test_pool').insert({
        lang, difficulty, questions: allQuestions,
        verbal_count: verbalQs.length, analytical_count: analyticalQs.length
      }).select('id').single();
      if (poolInsert && email) {
        await supabase.from('user_seen_tests').upsert(
          { email, test_id: poolInsert.id },
          { onConflict: 'email,test_id', ignoreDuplicates: true }
        );
      }
    } catch (poolInsertErr) {
      console.error('Uloženie do poolu zlyhalo (test sa aj tak pošle userovi):', poolInsertErr.message);
    }

    res.json({
      success: true,
      verbal: verbalQs.length,
      analytical: analyticalQs.length,
      total: allQuestions.length,
      questions: allQuestions
    });

  } catch(err) {
    console.error('Chyba generovania celého testu:', err.message);`;

src = replaceExactCount(src, INSERT_OLD, INSERT_NEW, 1, 'pool insert insertion point');

const backup = FILE + '.pre-288-shared-test-pool-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ server.js: /api/generate-full-test teraz najprv skúsi zdieľaný pool vygenerovaných testov pred AI generovaním.');
console.log('✅ server.js: nové testy sa po vygenerovaní ukladajú do poolu pre budúcich klientov.');
console.log('   Záloha:', backup);
console.log('');
console.log('🚨 DÔLEŽITÉ: pm2 restart sptrener-main, potom over:');
console.log('   1. Vygeneruj test -- mal by prejsť normálne (pool je na začiatku prázdny, takže prvých N requestov pre každú kombináciu jazyk+obtiažnosť pôjde cez AI ako doteraz).');
console.log('   2. Vygeneruj druhý test v TEJ ISTEJ obtiažnosti/jazyku pod iným emailom -- v logoch by malo byť "Test z poolu (id=...)" namiesto "Generujem celý AI test".');
console.log('   3. Over v DB (tabuľka generated_test_pool), že sa testy skutočne ukladajú a rastú v počte.');
