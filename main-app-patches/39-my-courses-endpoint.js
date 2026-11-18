const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("app.get('/api/user/my-courses'")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

const OLD = `app.get('/api/user/has-course', requireCourseBuyer, async (req, res) => {
  try {
    const { count } = await supabase.from('course_purchases').select('*', { count: 'exact', head: true }).eq('email', req.userEmail);
    res.json({ hasCourse: (count || 0) > 0 });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});`;
const NEW = `app.get('/api/user/has-course', requireCourseBuyer, async (req, res) => {
  try {
    const { count } = await supabase.from('course_purchases').select('*', { count: 'exact', head: true }).eq('email', req.userEmail);
    res.json({ hasCourse: (count || 0) > 0 });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.get('/api/user/my-courses', requireCourseBuyer, async (req, res) => {
  try {
    const { data: purchases } = await supabase.from('course_purchases').select('course_id').eq('email', req.userEmail);
    const courseIds = [...new Set((purchases || []).map(p => p.course_id))];
    if (!courseIds.length) return res.json({ courses: [] });

    const { data: courses } = await supabase.from('courses').select('id,slug,title,cover_image_url').in('id', courseIds);
    const { data: allLessons } = await supabase.from('course_lessons').select('id,course_id').in('course_id', courseIds);
    const { data: progress } = await supabase.from('course_lesson_progress').select('lesson_id,course_id').eq('email', req.userEmail).in('course_id', courseIds);

    const lessonCountByCourse = {};
    (allLessons || []).forEach(l => { lessonCountByCourse[l.course_id] = (lessonCountByCourse[l.course_id] || 0) + 1; });
    const doneCountByCourse = {};
    (progress || []).forEach(p => { doneCountByCourse[p.course_id] = (doneCountByCourse[p.course_id] || 0) + 1; });

    const result = (courses || []).map(c => ({
      slug: c.slug, title: c.title, coverUrl: c.cover_image_url,
      totalLessons: lessonCountByCourse[c.id] || 0,
      completedLessons: doneCountByCourse[c.id] || 0
    }));
    res.json({ courses: result });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});`;

const count = src.split(OLD).length - 1;
if (count !== 1) { console.error('Kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }

const patched = src.replace(OLD, NEW);

const backup = FILE + '.pre-my-courses-endpoint-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
