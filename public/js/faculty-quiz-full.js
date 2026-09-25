(function(){
  var SUPABASE_URL='https://zrnqiwareacqyndwchsv.supabase.co';
  var SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpybnFpd2FyZWFjcXluZHdjaHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMDA3NTAsImV4cCI6MjA4OTc3Njc1MH0.iUne23YDxp12Iwxdk9U8MfcV0NTBtrNf9OgsjQdiADk';
  var _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  var ctx = window.FACULTY_CONTEXT || {};
  var currentUser = null;

  function el(id) { return document.getElementById(id); }

  function updateRegisterBtn() {
    var box = el('fqVopCheckbox');
    var btn = el('fqRegisterBtn');
    if (btn) btn.disabled = !(box && box.checked);
  }

  function startRegister() {
    var box = el('fqVopCheckbox');
    if (!box || !box.checked) return;
    var marketing = el('fqMarketingCheckbox');
    sessionStorage.setItem('fq_pending', '1');
    sessionStorage.setItem('fq_marketing', (marketing && marketing.checked) ? '1' : '0');
    sessionStorage.setItem('fq_pct', String(ctx.pct || ''));
    sessionStorage.setItem('fq_scores', JSON.stringify(ctx.scores || {}));
    if (currentUser) {
      finishReveal();
      return;
    }
    _supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } });
  }

  function hideRegisterForm() {
    var vop = el('fqVopCheckbox');
    if (vop && vop.closest) { var vopRow = vop.closest('.fq-consent-row'); if (vopRow) vopRow.style.display = 'none'; }
    var mkt = el('fqMarketingCheckbox');
    if (mkt && mkt.closest) { var mktRow = mkt.closest('.fq-consent-row'); if (mktRow) mktRow.style.display = 'none'; }
    var btn = el('fqRegisterBtn');
    if (btn) btn.style.display = 'none';
  }

  var VERDICT_TEXT = {
    sk: { high: 'Vyzerá to, že by ti to mohlo sedieť!', mid: 'Čiastočná zhoda — oplatí sa preskúmať aj iné odbory.', low: 'Asi to nie je presne pre teba — skús si spraviť aj plný test.' },
    cs: { high: 'Vypadá to, že by ti to mohlo sedět!', mid: 'Částečná shoda — stojí za to prozkoumat i jiné obory.', low: 'Asi to není přesně pro tebe — zkus si udělat i plný test.' }
  };
  var DIM_LABEL = {
    sk: { interest: 'Záujem', aptitude: 'Predpoklady', reality: 'Realita povolania' },
    cs: { interest: 'Zájem', aptitude: 'Předpoklady', reality: 'Realita povolání' }
  };
  var GAP_WARNING = {
    sk: 'Zaujíma ťa to viac, než koľko si zatiaľ vieš predstaviť realitu tohto povolania — oplatí sa to preskúmať hlbšie (napr. porozprávať sa s niekým, kto to už robí).',
    cs: 'Zajímá tě to víc, než kolik si zatím umíš představit realitu tohoto povolání — vyplatí se to prozkoumat hlouběji (např. promluvit si s někým, kdo to už dělá).'
  };

  function renderResultHtml(pct, scores) {
    var lang = ctx.lang === 'cs' ? 'cs' : 'sk';
    var v = VERDICT_TEXT[lang];
    var verdict = pct >= 70 ? v.high : (pct >= 40 ? v.mid : v.low);
    var dl = DIM_LABEL[lang];
    function row(key) {
      var val = (scores && typeof scores[key] === 'number') ? scores[key] : 0;
      return '<div class="fq-dim-row"><span class="fq-dim-name">' + dl[key] + '</span><div class="fq-dim-track"><div class="fq-dim-fill" style="width:' + val + '%"></div></div><span class="fq-dim-pct">' + val + '%</span></div>';
    }
    var barsHtml = '<div class="fq-dim-bars">' + row('interest') + row('aptitude') + row('reality') + '</div>';
    var gapHtml = (scores && (scores.interest - scores.reality >= 25)) ? ('<div class="fq-gap-warning">💡 ' + GAP_WARNING[lang] + '</div>') : '';
    return '<div class="fq-pct">' + pct + '%</div>' + barsHtml + '<p>' + verdict + '</p>' + gapHtml;
  }

  function drawQr(c, text, x, y, size) {
    var qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    var count = qr.getModuleCount();
    var moduleSize = size / count;
    c.fillStyle = '#ffffff';
    c.fillRect(x - 14, y - 14, size + 28, size + 28);
    c.fillStyle = '#08080d';
    for (var row = 0; row < count; row++) {
      for (var col = 0; col < count; col++) {
        if (qr.isDark(row, col)) c.fillRect(x + col * moduleSize, y + row * moduleSize, Math.ceil(moduleSize), Math.ceil(moduleSize));
      }
    }
  }

  function wrapText(c, text, x, y, maxWidth, lineHeight) {
    var words = String(text || '').split(' ');
    var line = '';
    var curY = y;
    for (var n = 0; n < words.length; n++) {
      var testLine = line + words[n] + ' ';
      if (c.measureText(testLine).width > maxWidth && n > 0) {
        c.fillText(line, x, curY);
        line = words[n] + ' ';
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    c.fillText(line, x, curY);
    return curY;
  }

  function generateResultImage(userName) {
    return new Promise(function(resolve, reject) {
      try {
        var W = 1240, H = 1754;
        var canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        var c = canvas.getContext('2d');
        var grad = c.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#08080d');
        grad.addColorStop(1, '#0f0f18');
        c.fillStyle = grad;
        c.fillRect(0, 0, W, H);
        c.textAlign = 'center';

        c.fillStyle = '#c8ff00';
        c.font = '600 32px sans-serif';
        c.fillText('SP TRÉNER · TEST ODBORU', W / 2, 160);

        if (userName) {
          c.fillStyle = '#a1a1bc';
          c.font = '600 34px sans-serif';
          c.fillText(userName, W / 2, 220);
        }

        c.font = '190px sans-serif';
        c.fillText(ctx.icon || '🎓', W / 2, 480);

        c.fillStyle = '#eeeef5';
        c.font = '600 58px Georgia, serif';
        var title = (ctx.lang === 'cs' ? 'Sedí mi ' : 'Sedí mi ') + (ctx.faculty || '') + '.';
        var afterTitleY = wrapText(c, title, W / 2, 640, 1000, 72);

        c.fillStyle = '#a1a1bc';
        c.font = '32px sans-serif';
        var sub = (ctx.university || '') + (ctx.city ? (' — ' + ctx.city) : '');
        var afterSubY = wrapText(c, sub, W / 2, afterTitleY + 60, 940, 44);

        c.fillStyle = '#c8ff00';
        c.font = '600 90px Georgia, serif';
        c.fillText((ctx.pct || '0') + '%', W / 2, afterSubY + 150);

        var qrSize = 250;
        var qrX = W / 2 - qrSize / 2;
        var qrY = Math.max(afterSubY + 230, 1280);
        drawQr(c, location.origin + location.pathname, qrX, qrY, qrSize);

        c.fillStyle = '#eeeef5';
        c.font = '600 28px sans-serif';
        c.fillText(ctx.lang === 'cs' ? 'Udělej si test taky →' : 'Sprav si test aj ty →', W / 2, qrY + qrSize + 56);
        c.fillStyle = '#5c5c7a';
        c.font = '24px sans-serif';
        c.fillText('sptrener.online', W / 2, qrY + qrSize + 92);

        canvas.toBlob(function(blob) { blob ? resolve(blob) : reject(new Error('toBlob zlyhalo')); }, 'image/png');
      } catch (e) { reject(e); }
    });
  }

  function finishReveal() {
    var qEl = el('fqQuestions');
    if (qEl) qEl.style.display = 'none';
    var submitEl = el('fqSubmit');
    if (submitEl) submitEl.style.display = 'none';

    var section = el('fqRegisterSection');
    if (section) section.style.display = 'block';
    hideRegisterForm();
    var box = el('fqRegisterBox');
    var marketing = sessionStorage.getItem('fq_marketing') === '1';
    var pct = sessionStorage.getItem('fq_pct');
    var scores = {};
    try { scores = JSON.parse(sessionStorage.getItem('fq_scores') || '{}'); } catch (e) {}
    var userName = (currentUser.user_metadata && (currentUser.user_metadata.full_name || currentUser.user_metadata.name)) || '';

    var resultEl = el('fqResult');
    if (resultEl) {
      resultEl.style.display = 'block';
      resultEl.innerHTML = renderResultHtml(Number(pct) || 0, scores);
    }

    _supabase.from('career_quiz_results').insert({
      user_id: currentUser.id, email: currentUser.email,
      answers: {}, scores: scores, top_field: ctx.tag || null,
      marketing_consent: !!marketing, lang: ctx.lang,
      top_field_name: ctx.faculty || '', top_field_desc: (ctx.university || '') + (ctx.city ? (', ' + ctx.city) : '')
    }).then(function(){}, function(){});

    if (pct !== null && pct !== '') ctx.pct = pct;

    var appCat = ctx.appCat || 'vsp';
    var appHref = '/app?cat=' + encodeURIComponent(appCat) + '&upgrade=free';
    var appLabel = ctx.lang === 'cs' ? 'Začít se připravovat zdarma →' : 'Začni sa pripravovať zadarmo →';

    if (box) {
      box.innerHTML = '';
      var appBtn = document.createElement('a');
      appBtn.href = appHref;
      appBtn.className = 'fq-cta';
      appBtn.style.display = 'inline-block';
      appBtn.textContent = appLabel;
      box.appendChild(appBtn);
      var status = document.createElement('div');
      status.id = 'fqImgStatus';
      status.style.marginTop = '1rem';
      status.textContent = ctx.lang === 'cs' ? 'Připravuji obrázek ke sdílení…' : 'Pripravujem obrázok na zdieľanie…';
      box.appendChild(status);
    }

    generateResultImage(userName).then(function(blob) {
      var url = URL.createObjectURL(blob);
      var status = el('fqImgStatus');
      if (!status) return;
      status.innerHTML = '';
      var img = document.createElement('img');
      img.src = url;
      img.style.maxWidth = '100%';
      img.style.borderRadius = '12px';
      img.style.marginBottom = '.6rem';
      var dl = document.createElement('a');
      dl.href = url;
      dl.download = 'sp-trener-vysledok.png';
      dl.className = 'fq-cta-secondary';
      dl.style.display = 'block';
      dl.textContent = ctx.lang === 'cs' ? 'Stáhnout obrázek ke sdílení →' : 'Stiahnuť obrázok na zdieľanie →';
      status.appendChild(img);
      status.appendChild(dl);
    }, function() {
      var status = el('fqImgStatus');
      if (status) status.textContent = '';
    });

    sessionStorage.removeItem('fq_pending');
  }

  document.addEventListener('DOMContentLoaded', function() {
    var vop = el('fqVopCheckbox');
    if (vop) vop.addEventListener('change', updateRegisterBtn);
    var btn = el('fqRegisterBtn');
    if (btn) btn.addEventListener('click', startRegister);

    _supabase.auth.getSession().then(function(res) {
      currentUser = res.data.session ? res.data.session.user : null;
      if (currentUser && sessionStorage.getItem('fq_pending') === '1') finishReveal();
    });
    _supabase.auth.onAuthStateChange(function(event, session) {
      if (event === 'SIGNED_IN' && session && session.user) {
        currentUser = session.user;
        if (sessionStorage.getItem('fq_pending') === '1') finishReveal();
      }
    });
  });

  window.__facultyQuizShowRegister = function(pct, scores) {
    ctx.pct = pct;
    ctx.scores = scores;
    var section = el('fqRegisterSection');
    if (section) section.style.display = 'block';
  };
})();
