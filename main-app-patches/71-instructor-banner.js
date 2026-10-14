const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

const L = (...lines) => lines.join('\n');

if (src.includes('course-instructor-banner')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── A: fetch instructor row (for banner fields) right after course lookup ──
patched = replaceOnce(patched,
  L(
    "    const { data: course } = await supabase.from('courses').select('*').eq('slug', req.params.slug).eq('published', true).single();",
    "    if (!course) return res.status(404).send('Kurz sa nenašiel.');"
  ),
  L(
    "    const { data: course } = await supabase.from('courses').select('*').eq('slug', req.params.slug).eq('published', true).single();",
    "    if (!course) return res.status(404).send('Kurz sa nenašiel.');",
    "    let courseInstructor = null;",
    "    if (course.instructor_id) {",
    "      const { data: instr } = await supabase.from('instructors').select('name, banner_image_url, banner_link_url').eq('id', course.instructor_id).maybeSingle();",
    "      courseInstructor = instr;",
    "    }"
  ),
  'A: fetch courseInstructor');

// ── B: build bannerHtml right after instructorHtml, before body template ──
patched = replaceOnce(patched,
  L(
    '      </div>',
    "    </div>` : '';",
    '    const body = `${KURZY_STYLE}<main class="page">'
  ),
  L(
    '      </div>',
    "    </div>` : '';",
    "    const bannerHtml = (courseInstructor && courseInstructor.banner_image_url && courseInstructor.banner_link_url) ? `<div class=\"course-instructor-banner\" style=\"margin:0 0 1.4rem\">",
    '      <p style="font-size:.78rem;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.5rem">Tento kurz ti prináša</p>',
    '      <a href="/api/courses/${course.slug}/banner-click" rel="sponsored noopener"><img src="${escapeHtml(courseInstructor.banner_image_url)}" alt="${escapeHtml(courseInstructor.name || \'\')}" loading="lazy" style="max-width:100%;border-radius:12px;display:block"></a>',
    "    </div>` : '';",
    '    const body = `${KURZY_STYLE}<main class="page">'
  ),
  'B: build bannerHtml');

// ── C: render bannerHtml under instructorHtml in the page body ──
patched = replaceOnce(patched,
  L(
    '      ${instructorHtml}',
    '      <h2 class="course-outline-heading">${T.outlineHeading}</h2>'
  ),
  L(
    '      ${instructorHtml}',
    '      ${bannerHtml}',
    '      <h2 class="course-outline-heading">${T.outlineHeading}</h2>'
  ),
  'C: render bannerHtml');

// ── D: click-tracking redirect route, registered right before /kurzy/:slug ──
patched = replaceOnce(patched,
  L(
    "app.get('/kurzy/:slug', async (req, res) => {",
    '  try {',
    '    const lang = blogLang(req);'
  ),
  L(
    "app.get('/api/courses/:slug/banner-click', async (req, res) => {",
    '  try {',
    "    const { data: course } = await supabase.from('courses').select('id, slug, instructor_id').eq('slug', req.params.slug).maybeSingle();",
    "    if (!course || !course.instructor_id) return res.redirect('/kurzy/' + req.params.slug);",
    "    const { data: instructor } = await supabase.from('instructors').select('id, banner_link_url').eq('id', course.instructor_id).maybeSingle();",
    "    if (!instructor || !instructor.banner_link_url) return res.redirect('/kurzy/' + req.params.slug);",
    "    supabase.from('instructor_banner_clicks').insert({ instructor_id: instructor.id, course_id: course.id }).then(() => {}).catch(() => {});",
    '    res.redirect(instructor.banner_link_url);',
    '  } catch (e) {',
    "    res.redirect('/kurzy/' + req.params.slug);",
    '  }',
    '});',
    '',
    "app.get('/kurzy/:slug', async (req, res) => {",
    '  try {',
    '    const lang = blogLang(req);'
  ),
  'D: banner-click route');

const backup = FILE + '.pre-instructor-banner-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
