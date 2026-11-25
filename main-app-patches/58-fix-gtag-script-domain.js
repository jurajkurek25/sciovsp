const fs = require('fs');
const FILE = 'public/index.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("sptrener.online/s-sHyo81JaoooVi-do7OzuEaYUzzygOmRdRXB2MpYqTgJTQswErbxCIdTD9mSYGH5vA50PUoR8e3w67oVVQjSSeApkGDmwssmGq2PF1hu8E90MkJlbgl2x-dsVJ40UYhtk5EjBlGq0Cnq42z_W8LnFiAoimElCg_21EltHvo9YzgHMrzlpiH6De9ukCEumAytHetObSBWePnKdCyZWfg16J5LuA6GAGggBVbR73gtpd-gWo4iLYm0fvM7IgSa35wc0AiIhCRjX2qDw9BCOwMmEYE-WBYp3KovPDmvQOskzQX104geGqlHv3F1j-U-LRqb25vkdl-cMt6T-x6z6WG0Uv3xE0zMskBYGcAPlf9lFBxayPY0G6aRqkdjs-_MrjOSBwAPVxXc0MC6Eq8J4ZRZMEps-0DZ41KIeXhr53ssGTNUPTBxpy2LdDdQQuoJN577pHs_xZT96nZl7cE1FGBQ_lYjeXmsaNKEsgxoq5BKsN4m5jlYjvVAwQWwT8qALHUndR7aJQ79f6d6EFGWCjgKcgyKSt908EWS9n-vggKzIYR15oj_opeQfb6yT-m")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const OLD = "https://91.99.188.203:8443/s-sHyo81JaoooVi-do7OzuEaYUzzygOmRdRXB2MpYqTgJTQswErbxCIdTD9mSYGH5vA50PUoR8e3w67oVVQjSSeApkGDmwssmGq2PF1hu8E90MkJlbgl2x-dsVJ40UYhtk5EjBlGq0Cnq42z_W8LnFiAoimElCg_21EltHvo9YzgHMrzlpiH6De9ukCEumAytHetObSBWePnKdCyZWfg16J5LuA6GAGggBVbR73gtpd-gWo4iLYm0fvM7IgSa35wc0AiIhCRjX2qDw9BCOwMmEYE-WBYp3KovPDmvQOskzQX104geGqlHv3F1j-U-LRqb25vkdl-cMt6T-x6z6WG0Uv3xE0zMskBYGcAPlf9lFBxayPY0G6aRqkdjs-_MrjOSBwAPVxXc0MC6Eq8J4ZRZMEps-0DZ41KIeXhr53ssGTNUPTBxpy2LdDdQQuoJN577pHs_xZT96nZl7cE1FGBQ_lYjeXmsaNKEsgxoq5BKsN4m5jlYjvVAwQWwT8qALHUndR7aJQ79f6d6EFGWCjgKcgyKSt908EWS9n-vggKzIYR15oj_opeQfb6yT-m";
const NEW = "https://sptrener.online/s-sHyo81JaoooVi-do7OzuEaYUzzygOmRdRXB2MpYqTgJTQswErbxCIdTD9mSYGH5vA50PUoR8e3w67oVVQjSSeApkGDmwssmGq2PF1hu8E90MkJlbgl2x-dsVJ40UYhtk5EjBlGq0Cnq42z_W8LnFiAoimElCg_21EltHvo9YzgHMrzlpiH6De9ukCEumAytHetObSBWePnKdCyZWfg16J5LuA6GAGggBVbR73gtpd-gWo4iLYm0fvM7IgSa35wc0AiIhCRjX2qDw9BCOwMmEYE-WBYp3KovPDmvQOskzQX104geGqlHv3F1j-U-LRqb25vkdl-cMt6T-x6z6WG0Uv3xE0zMskBYGcAPlf9lFBxayPY0G6aRqkdjs-_MrjOSBwAPVxXc0MC6Eq8J4ZRZMEps-0DZ41KIeXhr53ssGTNUPTBxpy2LdDdQQuoJN577pHs_xZT96nZl7cE1FGBQ_lYjeXmsaNKEsgxoq5BKsN4m5jlYjvVAwQWwT8qALHUndR7aJQ79f6d6EFGWCjgKcgyKSt908EWS9n-vggKzIYR15oj_opeQfb6yT-m";

const patched = replaceOnce(src, OLD, NEW, 'gtag proxy script host');

const backup = FILE + '.pre-fix-gtag-script-domain-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
