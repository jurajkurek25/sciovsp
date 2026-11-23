// Adds Elite as a selectable option on public/darcekova-karta.html.
// Idempotent — safe to re-run.
const fs = require('fs');
const FILE = 'public/darcekova-karta.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("eliteOpts")) {
  console.error('Uz je aplikovane (najdene eliteOpts), nic som nezmenil.');
  process.exit(1);
}

function applyOne(src, old, neu, label, expectedCount) {
  expectedCount = expectedCount || 1;
  const count = src.split(old).length - 1;
  if (count !== expectedCount) {
    console.error(`ABORT (${label}): anchor occurs ${count} times (expected ${expectedCount}). No changes made.`);
    process.exit(1);
  }
  return src.split(old).join(neu);
}

let out = src;

// 1) Filter elite options out of the fetched list
out = applyOne(out,
  `    const premiumOpts = allOptions.filter(o => o.kind === 'premium').sort((a, b) => a.sort_order - b.sort_order);
    const courseOpts = allOptions.filter(o => o.kind === 'course').sort((a, b) => a.sort_order - b.sort_order);`,
  `    const premiumOpts = allOptions.filter(o => o.kind === 'premium').sort((a, b) => a.sort_order - b.sort_order);
    const eliteOpts = allOptions.filter(o => o.kind === 'elite').sort((a, b) => a.sort_order - b.sort_order);
    const courseOpts = allOptions.filter(o => o.kind === 'course').sort((a, b) => a.sort_order - b.sort_order);`,
  'filter'
);

// 2) Render an Elite section between Premium and Course
out = applyOne(out,
  `    if (premiumOpts.length) {
      html += '<div class="section-label">Premium predplatné</div><div class="opt-grid">' + premiumOpts.map(o => optCardHtml(o)).join('') + '</div>';
    }
    if (courseOpts.length) {`,
  `    if (premiumOpts.length) {
      html += '<div class="section-label">Premium predplatné</div><div class="opt-grid">' + premiumOpts.map(o => optCardHtml(o)).join('') + '</div>';
    }
    if (eliteOpts.length) {
      html += '<div class="section-label">Elite predplatné</div><div class="opt-grid">' + eliteOpts.map(o => optCardHtml(o)).join('') + '</div>';
    }
    if (courseOpts.length) {`,
  'render section'
);

// 3) Icon: three-way
out = applyOne(out,
  `  const icon = o.kind === 'premium' ? '💎' : '🎓';`,
  `  const icon = o.kind === 'premium' ? '💎' : o.kind === 'elite' ? '🔥' : '🎓';`,
  'icon'
);

// 4) canAddon: elite can also bundle a course add-on
out = applyOne(out,
  `  const canAddon = selectedOption.kind === 'premium' && addonOption;`,
  `  const canAddon = (selectedOption.kind === 'premium' || selectedOption.kind === 'elite') && addonOption;`,
  'canAddon'
);

// 5) includeAddon appears twice (updateSummary + buy handler) — same fix both places
out = applyOne(out,
  `  const includeAddon = selectedOption.kind === 'premium' && addonOption && $('#addonCheck').checked;`,
  `  const includeAddon = (selectedOption.kind === 'premium' || selectedOption.kind === 'elite') && addonOption && $('#addonCheck').checked;`,
  'includeAddon',
  2
);

const backup = FILE + '.pre-elite-picker-ui-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, out);
console.log('OK - zaloha:', backup);
