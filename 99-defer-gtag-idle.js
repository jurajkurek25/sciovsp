// Patches public/index.html in place. Idempotent — safe to re-run.
// Defers the gtag.js fetch+exec (162KB, ~270ms main-thread) to idle time.
// The dataLayer/gtag() stub stays synchronous and tiny, so any gtag() calls
// made before the real script loads are queued and processed normally —
// no analytics events are lost, only the heavy script's load timing moves.
const fs = require('fs');
const FILE = 'public/index.html';
const src0 = fs.readFileSync(FILE, 'utf8');

const IDEMPOTENCY_MARKER = 'function loadGtag(){';

if (src0.includes(IDEMPOTENCY_MARKER)) {
  console.error('ALREADY APPLIED. Nothing changed.');
  process.exit(1);
}

const OLD = `  <!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-SHRPWTXJP2"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-SHRPWTXJP2');
</script>`;

const NEW = `  <!-- Google tag (gtag.js) — deferred to idle time; dataLayer queue preserves gtag() calls made before it loads -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-SHRPWTXJP2');
  (function(){
    function loadGtag(){
      var s=document.createElement('script');
      s.async=true;
      s.src='https://www.googletagmanager.com/gtag/js?id=G-SHRPWTXJP2';
      document.head.appendChild(s);
    }
    if('requestIdleCallback' in window){requestIdleCallback(loadGtag,{timeout:3000});}
    else{setTimeout(loadGtag,1);}
  })();
</script>`;

const count = src0.split(OLD).length - 1;
if (count !== 1) {
  console.error(`ABORT: anchor occurs ${count} times (expected 1). No changes made.`);
  process.exit(1);
}

const backup = FILE + '.pre-defer-gtag-' + Date.now();
fs.copyFileSync(FILE, backup);
const patched = src0.split(OLD).join(NEW);
fs.writeFileSync(FILE, patched, 'utf8');
console.log('OK - zaloha:', backup);
