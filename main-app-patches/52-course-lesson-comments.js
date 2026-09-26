const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

const L = (...lines) => lines.join('\n');

if (src.includes('course_lesson_comments')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── nodemailer setup, right after the pdfkit require ──────────────────────
patched = replaceOnce(patched,
  "const PDFDocument = require('pdfkit');",
  L(
    "const PDFDocument = require('pdfkit');",
    "const nodemailer = require('nodemailer');",
    "let courseCommentTransporter = null;",
    "if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {",
    "  courseCommentTransporter = nodemailer.createTransport({",
    "    host: process.env.SMTP_HOST,",
    "    port: Number(process.env.SMTP_PORT) || 587,",
    "    secure: Number(process.env.SMTP_PORT) === 465,",
    "    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }",
    "  });",
    "}",
    "async function notifyInstructorNewComment({ courseTitle, lessonTitle, studentEmail, body }) {",
    "  if (!courseCommentTransporter || !process.env.ADMIN_EMAIL) return;",
    "  try {",
    "    await courseCommentTransporter.sendMail({",
    "      from: process.env.SMTP_USER,",
    "      to: process.env.ADMIN_EMAIL,",
    "      subject: '[SP Tréner Kurzy] Nová otázka — ' + courseTitle + ' / ' + lessonTitle,",
    "      text: studentEmail + ' napísal(a) v lekcii \"' + lessonTitle + '\" kurzu \"' + courseTitle + '\":\\n\\n' + body + '\\n\\nOdpovedz v dash → Kurzy → Otázky ku kurzu.'",
    "    });",
    "  } catch (e) {",
    "    console.error('notifyInstructorNewComment failed:', e.message);",
    "  }",
    "}",
    "function maskCommentEmail(email) {",
    "  const local = String(email || '').split('@')[0] || 'používateľ';",
    "  return local.length > 3 ? local.slice(0, 3) + '***' : local + '***';",
    "}"
  ),
  'nodemailer setup');

// ── new routes, right after the /access route ─────────────────────────────
patched = replaceOnce(patched,
  L(
    "    res.json({ course: { title: course.title, slug: course.slug }, lessons: outLessons });",
    "  } catch (e) {",
    "    res.status(500).json({ error: 'Chyba servera.' });",
    "  }",
    "});"
  ),
  L(
    "    res.json({ course: { title: course.title, slug: course.slug }, lessons: outLessons });",
    "  } catch (e) {",
    "    res.status(500).json({ error: 'Chyba servera.' });",
    "  }",
    "});",
    "",
    "app.get('/api/courses/:slug/lessons/:lessonId/comments', requireCourseBuyer, async (req, res) => {",
    "  try {",
    "    const { data: course } = await supabase.from('courses').select('id').eq('slug', req.params.slug).single();",
    "    if (!course) return res.status(404).json({ error: 'Kurz sa nenašiel.' });",
    "    const { data: purchase } = await supabase.from('course_purchases').select('id').eq('course_id', course.id).eq('email', req.userEmail).maybeSingle();",
    "    if (!purchase) return res.status(403).json({ error: 'Tento kurz nemáš zakúpený.' });",
    "    const { data: rows } = await supabase.from('course_lesson_comments').select('*').eq('lesson_id', req.params.lessonId).order('created_at');",
    "    const comments = (rows || []).map(c => ({",
    "      id: c.id, parentId: c.parent_id, isInstructor: c.is_instructor,",
    "      isOwn: c.email === req.userEmail,",
    "      authorLabel: c.is_instructor ? 'Lektor' : (c.email === req.userEmail ? 'Ty' : maskCommentEmail(c.email)),",
    "      body: c.body, createdAt: c.created_at",
    "    }));",
    "    res.json({ comments });",
    "  } catch (e) {",
    "    res.status(500).json({ error: 'Chyba servera.' });",
    "  }",
    "});",
    "",
    "app.post('/api/courses/:slug/lessons/:lessonId/comments', requireCourseBuyer, async (req, res) => {",
    "  try {",
    "    const { body, parentId } = req.body || {};",
    "    if (!body || !body.trim()) return res.status(400).json({ error: 'Chýba text komentára.' });",
    "    const { data: course } = await supabase.from('courses').select('id,title').eq('slug', req.params.slug).single();",
    "    if (!course) return res.status(404).json({ error: 'Kurz sa nenašiel.' });",
    "    const { data: purchase } = await supabase.from('course_purchases').select('id').eq('course_id', course.id).eq('email', req.userEmail).maybeSingle();",
    "    if (!purchase) return res.status(403).json({ error: 'Tento kurz nemáš zakúpený.' });",
    "    const { data: lesson } = await supabase.from('course_lessons').select('id,title').eq('id', req.params.lessonId).eq('course_id', course.id).single();",
    "    if (!lesson) return res.status(404).json({ error: 'Lekcia sa nenašla.' });",
    "    const { data: inserted, error } = await supabase.from('course_lesson_comments').insert({",
    "      course_id: course.id, lesson_id: lesson.id, parent_id: parentId || null,",
    "      email: req.userEmail, is_instructor: false, body: body.trim()",
    "    }).select().single();",
    "    if (error) return res.status(500).json({ error: 'Chyba servera.' });",
    "    notifyInstructorNewComment({ courseTitle: course.title, lessonTitle: lesson.title, studentEmail: req.userEmail, body: body.trim() });",
    "    res.json({ ok: true, comment: { id: inserted.id, parentId: inserted.parent_id, isInstructor: false, isOwn: true, authorLabel: 'Ty', body: inserted.body, createdAt: inserted.created_at } });",
    "  } catch (e) {",
    "    res.status(500).json({ error: 'Chyba servera.' });",
    "  }",
    "});"
  ),
  'comments routes placement');

const backup = FILE + '.pre-course-lesson-comments-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
