const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('course_lesson_submissions')) {
  console.error('Uz je aplikovane (najdene course_lesson_submissions), nic som nezmenil.');
  process.exit(1);
}

const ACCESS_OLD = `    const { data: lessons } = await supabase.from('course_lessons').select('*').eq('course_id', course.id).order('sort_order');
    const { data: progress } = await supabase.from('course_lesson_progress').select('lesson_id').eq('course_id', course.id).eq('email', req.userEmail);
    const completedIds = new Set((progress || []).map(p => p.lesson_id));

    let unlocked = true;
    const outLessons = (lessons || []).map(l => {
      const isUnlocked = unlocked;
      if (!completedIds.has(l.id)) unlocked = false;
      return {
        id: l.id, title: l.title, sortOrder: l.sort_order, completed: completedIds.has(l.id), unlocked: isUnlocked,
        videoUrl: isUnlocked ? l.video_url : null,
        docUrl: isUnlocked ? l.doc_url : null,
        quizQuestion: isUnlocked ? l.quiz_question : null,
        quizOptionA: isUnlocked ? l.quiz_option_a : null,
        quizOptionB: isUnlocked ? l.quiz_option_b : null,
        quizOptionC: isUnlocked ? l.quiz_option_c : null,
        quizOptionD: isUnlocked ? l.quiz_option_d : null
      };
    });
    res.json({ course: { title: course.title, slug: course.slug }, lessons: outLessons });`;
const ACCESS_NEW = `    const { data: lessons } = await supabase.from('course_lessons').select('*').eq('course_id', course.id).order('sort_order');
    const { data: progress } = await supabase.from('course_lesson_progress').select('lesson_id').eq('course_id', course.id).eq('email', req.userEmail);
    const completedIds = new Set((progress || []).map(p => p.lesson_id));

    let unlocked = true;
    const outLessons = [];
    for (const l of (lessons || [])) {
      const isUnlocked = unlocked;
      if (!completedIds.has(l.id)) unlocked = false;
      let lastSubmission = null;
      if (isUnlocked && !completedIds.has(l.id) && l.requires_upload) {
        const { data: sub } = await supabase.from('course_lesson_submissions').select('ai_verdict,ai_feedback')
          .eq('lesson_id', l.id).eq('email', req.userEmail).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (sub) lastSubmission = { verdict: sub.ai_verdict, feedback: sub.ai_feedback };
      }
      outLessons.push({
        id: l.id, title: l.title, sortOrder: l.sort_order, completed: completedIds.has(l.id), unlocked: isUnlocked,
        videoUrl: isUnlocked ? l.video_url : null,
        docUrl: isUnlocked ? l.doc_url : null,
        quizQuestion: isUnlocked ? l.quiz_question : null,
        quizOptionA: isUnlocked ? l.quiz_option_a : null,
        quizOptionB: isUnlocked ? l.quiz_option_b : null,
        quizOptionC: isUnlocked ? l.quiz_option_c : null,
        quizOptionD: isUnlocked ? l.quiz_option_d : null,
        requiresUpload: isUnlocked ? !!l.requires_upload : false,
        uploadInstructions: isUnlocked ? l.upload_instructions : null,
        lastSubmission
      });
    }
    res.json({ course: { title: course.title, slug: course.slug }, lessons: outLessons });`;
if (!src.includes(ACCESS_OLD)) { console.error('Nenasiel som /access outLessons blok. Nic som nezmenil.'); process.exit(1); }

const ANSWER_OLD = `    const { data: lesson } = await supabase.from('course_lessons').select('*').eq('id', req.params.lessonId).eq('course_id', course.id).single();
    if (!lesson) return res.status(404).json({ error: 'Lekcia sa nenašla.' });

    const { data: allLessons } = await supabase.from('course_lessons').select('id,sort_order').eq('course_id', course.id).order('sort_order');
    const { data: progress } = await supabase.from('course_lesson_progress').select('lesson_id').eq('course_id', course.id).eq('email', req.userEmail);
    const completedIds = new Set((progress || []).map(p => p.lesson_id));
    const priorLessons = (allLessons || []).filter(l => l.sort_order < lesson.sort_order);
    if (priorLessons.some(l => !completedIds.has(l.id))) return res.status(403).json({ error: 'Najprv dokonči predchádzajúce lekcie.' });

    const correct = !lesson.quiz_correct || lesson.quiz_correct === option;
    if (correct) {
      await supabase.from('course_lesson_progress').upsert({
        course_id: course.id, lesson_id: lesson.id, email: req.userEmail
      }, { onConflict: 'course_id,lesson_id,email' });
    }
    const nextLesson = (allLessons || []).find(l => l.sort_order === lesson.sort_order + 1);
    res.json({ correct, nextLessonId: correct ? (nextLesson?.id || null) : null });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.get('/kurzy/:slug/watch', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kurz-watch.html'));
});`;
const ANSWER_NEW = `    const { data: lesson } = await supabase.from('course_lessons').select('*').eq('id', req.params.lessonId).eq('course_id', course.id).single();
    if (!lesson) return res.status(404).json({ error: 'Lekcia sa nenašla.' });
    if (lesson.requires_upload) return res.status(400).json({ error: 'Táto lekcia vyžaduje nahratie materiálu, nie kvíz.' });

    const { data: allLessons } = await supabase.from('course_lessons').select('id,sort_order').eq('course_id', course.id).order('sort_order');
    const { data: progress } = await supabase.from('course_lesson_progress').select('lesson_id').eq('course_id', course.id).eq('email', req.userEmail);
    const completedIds = new Set((progress || []).map(p => p.lesson_id));
    const priorLessons = (allLessons || []).filter(l => l.sort_order < lesson.sort_order);
    if (priorLessons.some(l => !completedIds.has(l.id))) return res.status(403).json({ error: 'Najprv dokonči predchádzajúce lekcie.' });

    const correct = !lesson.quiz_correct || lesson.quiz_correct === option;
    if (correct) {
      await supabase.from('course_lesson_progress').upsert({
        course_id: course.id, lesson_id: lesson.id, email: req.userEmail
      }, { onConflict: 'course_id,lesson_id,email' });
    }
    const nextLesson = (allLessons || []).find(l => l.sort_order === lesson.sort_order + 1);
    res.json({ correct, nextLessonId: correct ? (nextLesson?.id || null) : null });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

const SUBMISSION_MIME = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const MAX_SUBMISSION_SIZE = 10 * 1024 * 1024;

app.post('/api/courses/:slug/lessons/:lessonId/submit', requireCourseBuyer, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Nahrávanie zlyhalo.' });
    if (!req.file) return res.status(400).json({ error: 'Chýba súbor.' });
    if (!SUBMISSION_MIME.includes(req.file.mimetype)) return res.status(400).json({ error: 'Povolené je PNG, JPG, WEBP alebo PDF.' });
    if (req.file.size > MAX_SUBMISSION_SIZE) return res.status(400).json({ error: 'Súbor je príliš veľký (max 10 MB).' });
    try {
      const { data: course } = await supabase.from('courses').select('id').eq('slug', req.params.slug).single();
      if (!course) return res.status(404).json({ error: 'Kurz sa nenašiel.' });
      const { data: purchase } = await supabase.from('course_purchases').select('id').eq('course_id', course.id).eq('email', req.userEmail).maybeSingle();
      if (!purchase) return res.status(403).json({ error: 'Tento kurz nemáš zakúpený.' });

      const { data: lesson } = await supabase.from('course_lessons').select('*').eq('id', req.params.lessonId).eq('course_id', course.id).single();
      if (!lesson) return res.status(404).json({ error: 'Lekcia sa nenašla.' });
      if (!lesson.requires_upload) return res.status(400).json({ error: 'Táto lekcia nevyžaduje nahratie materiálu.' });

      const { data: allLessons } = await supabase.from('course_lessons').select('id,sort_order').eq('course_id', course.id).order('sort_order');
      const { data: progress } = await supabase.from('course_lesson_progress').select('lesson_id').eq('course_id', course.id).eq('email', req.userEmail);
      const completedIds = new Set((progress || []).map(p => p.lesson_id));
      const priorLessons = (allLessons || []).filter(l => l.sort_order < lesson.sort_order);
      if (priorLessons.some(l => !completedIds.has(l.id))) return res.status(403).json({ error: 'Najprv dokonči predchádzajúce lekcie.' });

      const filePath = \`\${course.id}/\${lesson.id}/\${Date.now()}-\${require('crypto').randomBytes(4).toString('hex')}\`;
      await supabase.storage.from('submissions').upload(filePath, req.file.buffer, { contentType: req.file.mimetype });

      let grade;
      try {
        grade = await callAnthropicGrade(lesson.upload_instructions || lesson.title, req.file.buffer, req.file.mimetype);
      } catch (e) {
        return res.status(502).json({ error: 'Chyba AI vyhodnotenia, skús to znova.' });
      }

      await supabase.from('course_lesson_submissions').insert({
        course_id: course.id, lesson_id: lesson.id, email: req.userEmail,
        file_path: filePath, file_mime: req.file.mimetype,
        ai_verdict: grade.verdict, ai_feedback: grade.feedback
      });

      let nextLessonId = null;
      if (grade.verdict === 'pass') {
        await supabase.from('course_lesson_progress').upsert({
          course_id: course.id, lesson_id: lesson.id, email: req.userEmail
        }, { onConflict: 'course_id,lesson_id,email' });
        const nextLesson = (allLessons || []).find(l => l.sort_order === lesson.sort_order + 1);
        nextLessonId = nextLesson?.id || null;
      }
      res.json({ verdict: grade.verdict, feedback: grade.feedback, nextLessonId });
    } catch (e) {
      console.error('lesson submit error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });
});

function callAnthropicGrade(instructions, fileBuffer, mimeType) {
  return new Promise((resolve, reject) => {
    const base64 = fileBuffer.toString('base64');
    const fileBlock = mimeType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } };
    const payload = JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system: 'Si prísny, ale spravodlivý hodnotiaci asistent kurzu SP Tréner. Dostaneš pokyny/kritériá od lektora a nahraný materiál od žiaka (obrázok alebo PDF). Over, či materiál spĺňa zadané pokyny/kritériá. Odpovedaj VÝLUČNE v JSON bez backticks: {"verdict":"pass" alebo "fail","feedback":"krátka spätná väzba po slovensky, 1-3 vety, čo je dobre / čo treba opraviť"}.',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: \`Pokyny/kritériá lektora: \${instructions}\\n\\nVyhodnoť priložený materiál žiaka podľa týchto pokynov.\` },
          fileBlock
        ]
      }]
    });
    const https = require('https');
    const apiReq = https.request({
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' }
    }, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          const text = parsed.content?.find(b => b.type === 'text')?.text || '';
          const clean = text.replace(/\`\`\`json\\s*/gi, '').replace(/\`\`\`\\s*/gi, '').trim();
          const result = JSON.parse(clean.replace(/,\\s*([}\\]])/g, '$1'));
          resolve({ verdict: result.verdict === 'pass' ? 'pass' : 'fail', feedback: String(result.feedback || '').slice(0, 1000) });
        } catch (e) { reject(e); }
      });
    });
    apiReq.on('error', reject);
    apiReq.write(payload); apiReq.end();
  });
}`;
if (!src.includes(ANSWER_OLD)) { console.error('Nenasiel som /answer + watch route blok. Nic som nezmenil.'); process.exit(1); }

const DESC_OLD = `product_data: { name: course.title, description: (course.description || '').slice(0, 300), ...(course.cover_image_url ? { images: [course.cover_image_url] } : {}) }`;
const DESC_NEW = `product_data: { name: course.title, ...(course.description ? { description: course.description.slice(0, 300) } : {}), ...(course.cover_image_url ? { images: [course.cover_image_url] } : {}) }`;
if (!src.includes(DESC_OLD)) { console.error('Nenasiel som product_data blok (Stripe description fix). Nic som nezmenil.'); process.exit(1); }

const patched = src.replace(ACCESS_OLD, ACCESS_NEW).replace(ANSWER_OLD, ANSWER_NEW).replace(DESC_OLD, DESC_NEW);

const backup = FILE + '.pre-lesson-upload-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
