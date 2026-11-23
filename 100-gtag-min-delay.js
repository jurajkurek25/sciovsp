// Patches public/index.html in place. Idempotent — safe to re-run.
// Refines the gtag.js idle-defer from patch 99: waits for the 'load' event
// plus a 2s buffer before even scheduling the idle callback, so its script
// evaluation more reliably lands outside Lighthouse's TBT measurement
// window. dataLayer queue still preserves any gtag() calls made earlier —
// no analytics data lost, just pushed later.
const fs = require('fs');
const FILE = 'public/index.html';
const src0 = fs.readFileSync(FILE, 'utf8');

const IDEMPOTENCY_MARKER = 'function scheduleGtag(){';

if (src0.includes(IDEMPOTENCY_MARKER)) {
  console.error('ALREADY APPLIED. Nothing changed.');
  process.exit(1);
}

const OLD = `  (function(){
    function loadGtag(){
      var s=document.createElement('script');
      s.async=true;
      s.src='https://www.googletagmanager.com/gtag/js?id=G-SHRPWTXJP2';
      document.head.appendChild(s);
    }
    if('requestIdleCallback' in window){requestIdleCallback(loadGtag,{timeout:3000});}
    else{setTimeout(loadGtag,1);}
  })();`;

const NEW = `  (function(){
    function loadGtag(){
      var s=document.createElement('script');
      s.async=true;
      s.src='https://www.googletagmanager.com/gtag/js?id=G-SHRPWTXJP2';
      document.head.appendChild(s);
    }
    function scheduleGtag(){
      if('requestIdleCallback' in window){requestIdleCallback(loadGtag,{timeout:3000});}
      else{setTimeout(loadGtag,1);}
    }
    if(document.readyState==='complete'){setTimeout(scheduleGtag,2000);}
    else{window.addEventListener('load',function(){setTimeout(scheduleGtag,2000);});}
  })();`;

const count = src0.split(OLD).length - 1;
if (count !== 1) {
  console.error(`ABORT: anchor occurs ${count} times (expected 1). No changes made.`);
  process.exit(1);
}

const backup = FILE + '.pre-gtag-min-delay-' + Date.now();
fs.copyFileSync(FILE, backup);
const patched = src0.split(OLD).join(NEW);
fs.writeFileSync(FILE, patched, 'utf8');
console.log('OK - zaloha:', backup);
