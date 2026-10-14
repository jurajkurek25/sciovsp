const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (!src.includes('course-instructor-banner')) {
  console.error('Patch 71 (instructor banner) este nie je aplikovany — najprv spusti 71-instructor-banner.js. Nic som nezmenil.');
  process.exit(1);
}
if (src.includes('aspect-ratio:3/1')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const OLD = '<a href="/api/courses/${course.slug}/banner-click" rel="sponsored noopener"><img src="${escapeHtml(courseInstructor.banner_image_url)}" alt="${escapeHtml(courseInstructor.name || \'\')}" loading="lazy" style="max-width:100%;border-radius:12px;display:block"></a>';
const NEW = '<a href="/api/courses/${course.slug}/banner-click" rel="sponsored noopener"><img src="${escapeHtml(courseInstructor.banner_image_url)}" alt="${escapeHtml(courseInstructor.name || \'\')}" loading="lazy" style="width:100%;aspect-ratio:3/1;object-fit:cover;border-radius:12px;display:block"></a>';

const patched = replaceOnce(src, OLD, NEW, 'banner img style');

const backup = FILE + '.pre-banner-consistent-crop-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
