// AI Coach pod lekciou kurzu — dostupný LEN pre kupcov daného kurzu
// (rovnaká ochrana ako Q&A komentáre, patch 52: requireCourseBuyer +
// explicitná kontrola course_purchases pre konkrétny kurz). Na rozdiel od
// /api/mentor (Elite) používa Claude web_search nástroj a systémový
// prompt vynucuje overenie faktov z aspoň 3 nezávislých zdrojov, kým sa
// zaviaže k odpovedi — vzdelávací obsah, halucinácia by tu vadila viac
// ako rýchlosť. Bez limitu na počet správ (rozhodnutie z konverzácie).
// Vyžaduje main-app-patches/132-course-lesson-ai-coach-watch.js (frontend).
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.131-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('/lessons/:lessonId/coach')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const ANCHOR = `    res.json({ ok: true, comment: { id: inserted.id, parentId: inserted.parent_id, isInstructor: false, isOwn: true, authorLabel: 'Ty', body: inserted.body, createdAt: inserted.created_at } });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.post('/api/courses/:slug/lessons/:lessonId/quiz-answer', requireCourseBuyer, async (req, res) => {`;

const NEW_BLOCK = `    res.json({ ok: true, comment: { id: inserted.id, parentId: inserted.parent_id, isInstructor: false, isOwn: true, authorLabel: 'Ty', body: inserted.body, createdAt: inserted.created_at } });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

// ── AI Coach pod lekciou — len pre kupcov kurzu, over faktov z 3+ zdrojov ──
app.post('/api/courses/:slug/lessons/:lessonId/coach', rateLimit, requireCourseBuyer, async (req, res) => {
  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });
  const { question } = req.body || {};
  if (!question || !question.trim()) return res.status(400).json({ error: 'Chýba otázka.' });
  try {
    const { data: course } = await supabase.from('courses').select('id,title').eq('slug', req.params.slug).single();
    if (!course) return res.status(404).json({ error: 'Kurz sa nenašiel.' });
    const { data: purchase } = await supabase.from('course_purchases').select('id').eq('course_id', course.id).eq('email', req.userEmail).maybeSingle();
    if (!purchase) return res.status(403).json({ error: 'Tento kurz nemáš zakúpený.' });
    const { data: lesson } = await supabase.from('course_lessons').select('id,title').eq('id', req.params.lessonId).eq('course_id', course.id).single();
    if (!lesson) return res.status(404).json({ error: 'Lekcia sa nenašla.' });
    const { data: quizRows } = await supabase.from('course_lesson_quiz_questions').select('question,option_a,option_b,option_c,option_d').eq('lesson_id', lesson.id).order('sort_order');
    const quizContext = (quizRows || []).map(q => '- ' + q.question + ' (' + [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean).join(' / ') + ')').join('\\n');

    callClaudeWithFallback((model) => new Promise((resolve) => {
      const payload = JSON.stringify({
        model,
        max_tokens: 800,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
        system: 'Si AI Coach pre kurz "' + course.title + '" na SP Tréner. Študent práve pozerá lekciu "' + lesson.title + '" a pýta sa na niečo do hĺbky.\\n' +
          'Pred akýmkoľvek faktickým tvrdením si ho over vo webovom vyhľadávaní z aspoň 3 nezávislých, dôveryhodných zdrojov. Ak sa zhodujú, odpovedz sebavedomo a stručne zdroje spomeň. Ak sa nezhodujú alebo dostatok nezávislých zdrojov nenájdeš, otvorene to priznaj a namiesto hádania odporuč opýtať sa lektora cez komentáre pod lekciou.\\n' +
          'Odpovedaj po slovensky, vecne, max 5-6 viet.',
        messages: [{
          role: 'user',
          content: 'Kurz: ' + course.title + '\\nLekcia: ' + lesson.title + (quizContext ? '\\nKvízové otázky tejto lekcie:\\n' + quizContext : '') + '\\n\\nOtázka študenta: ' + question.trim()
        }]
      });
      const https = require('https');
      const apiReq = https.request({
        hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' }
      }, (apiRes) => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => resolve({ ok: apiRes.statusCode >= 200 && apiRes.statusCode < 300, statusCode: apiRes.statusCode, data }));
      });
      apiReq.on('error', err => resolve({ ok: false, statusCode: 502, data: JSON.stringify({ error: { message: err.message } }) }));
      apiReq.write(payload); apiReq.end();
    })).then((result) => {
      try {
        const parsed = JSON.parse(result.data);
        if (parsed.error) return res.status(402).json({ error: parsed.error.message });
        const textReply = (parsed.content || []).filter(b => b.type === 'text').map(b => b.text).join('\\n').trim();
        res.json({ reply: textReply || 'Skús otázku preformulovať.' });
      } catch (e) { res.status(500).json({ error: 'Chyba.' }); }
    });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.post('/api/courses/:slug/lessons/:lessonId/quiz-answer', requireCourseBuyer, async (req, res) => {`;

const patched = replaceOnce(src, ANCHOR, NEW_BLOCK, 'coach route placement');

const backup = FILE + '.pre-course-lesson-ai-coach-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Web search stoji navyse $10/1000 vyhladavani + tokeny - sleduj naklady po nasadeni.');
