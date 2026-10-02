const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

const L = (...lines) => lines.join('\n');

if (src.includes('course-instructor-card')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── define instructorHtml + keep body template start intact ──────────────
patched = replaceOnce(patched,
  L(
    "    const salesHtml = course.sales_content ? `<article class=\"prose course-sales\">${course.sales_content}</article>` : '';",
    "    const body = `${KURZY_STYLE}<main class=\"page\">"
  ),
  L(
    "    const salesHtml = course.sales_content ? `<article class=\"prose course-sales\">${course.sales_content}</article>` : '';",
    "    const instructorHtml = course.instructor_name ? `<div class=\"course-instructor-card\" style=\"display:flex;gap:1rem;align-items:flex-start;background:var(--black2);border-radius:12px;padding:1.2rem;margin:1.4rem 0\">",
    "      ${course.instructor_photo_url ? `<img src=\"${escapeHtml(course.instructor_photo_url)}\" alt=\"${escapeHtml(course.instructor_name)}\" loading=\"lazy\" style=\"width:72px;height:72px;border-radius:50%;object-fit:cover;flex-shrink:0\">` : ''}",
    "      <div>",
    "        <div style=\"font-size:.78rem;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.2rem\">Lektor</div>",
    "        <div style=\"font-weight:600;font-size:1.05rem;margin-bottom:.3rem\">${escapeHtml(course.instructor_name)}</div>",
    "        ${course.instructor_bio ? `<p style=\"color:var(--text2);font-size:.92rem;margin:0\">${escapeHtml(course.instructor_bio)}</p>` : ''}",
    "      </div>",
    "    </div>` : '';",
    "    const body = `${KURZY_STYLE}<main class=\"page\">"
  ),
  'instructorHtml definition');

// ── place the card between the sales letter and the outline heading ──────
patched = replaceOnce(patched,
  L(
    "      ${salesHtml}",
    "      <h2 class=\"course-outline-heading\">${T.outlineHeading}</h2>"
  ),
  L(
    "      ${salesHtml}",
    "      ${instructorHtml}",
    "      <h2 class=\"course-outline-heading\">${T.outlineHeading}</h2>"
  ),
  'instructorHtml placement in body');

const backup = FILE + '.pre-course-instructor-card-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
