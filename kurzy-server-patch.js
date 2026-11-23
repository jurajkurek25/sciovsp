const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("app.get('/kurzy'")) {
  console.error('Uz je aplikovane (najdene /kurzy route), nic som nezmenil.');
  process.exit(1);
}

const WEBHOOK_OLD = `      case 'checkout.session.completed': {
        const session = event.data.object;
        const customer = await stripe.customers.retrieve(session.customer);
        const email = customer.email;`;
const WEBHOOK_NEW = `      case 'checkout.session.completed': {
        const session = event.data.object;

        // Kurzy (sptrener.online/kurzy) — jednorazova platba, uplne oddelene
        // od predplatneho nizsie (ziadny dopad na is_premium/plan).
        if (session.metadata?.type === 'course_purchase') {
          const courseCustomer = await stripe.customers.retrieve(session.customer);
          await supabase.from('course_purchases').upsert({
            course_id: session.metadata.courseId,
            email: courseCustomer.email,
            stripe_session_id: session.id,
            amount_paid_cents: session.amount_total
          }, { onConflict: 'course_id,email' });
          console.log('✅ Kurz zakúpený:', courseCustomer.email, session.metadata.courseSlug);
          break;
        }

        const customer = await stripe.customers.retrieve(session.customer);
        const email = customer.email;`;

if (!src.includes(WEBHOOK_OLD)) {
  console.error('Nenasiel som presny webhook blok. Nic som nezmenil.');
  process.exit(1);
}

const ANCHOR = `const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;`;
if (!src.includes(ANCHOR)) {
  console.error('Nenasiel som kotvu pre vlozenie /kurzy routov. Nic som nezmenil.');
  process.exit(1);
}

const KURZY_ROUTES = `// ─── KURZY (video kurzy s kvízom, jednorázová platba, teoretický doplnok k testom) ───

function courseCardHtml(c) {
  const priceStr = (c.price_cents / 100).toFixed(2).replace('.', ',');
  return \`<a class="course-card" href="/kurzy/\${c.slug}">
    <h3>\${escapeHtml(c.title)}</h3>
    <p>\${escapeHtml((c.description || '').slice(0, 140))}</p>
    <span class="course-price-tag">\${priceStr} €</span>
  </a>\`;
}

const KURZY_STYLE = \`<style>
.course-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.1rem;margin-top:1.6rem}
.course-card{display:block;background:var(--black2);border:1px solid var(--border);border-radius:14px;padding:1.3rem;text-decoration:none;color:var(--text)}
.course-card h3{font-family:var(--serif);font-size:1.3rem;margin-bottom:.5rem}
.course-card p{color:var(--text2);font-size:.85rem;margin-bottom:.8rem}
.course-price-tag{font-family:var(--mono);font-size:.8rem;color:var(--volt);font-weight:700}
.course-lesson-outline{margin:1.4rem 0;padding-left:1.2rem;color:var(--text2)}
.course-lesson-outline li{margin-bottom:.4rem}
.course-buy-box{display:flex;align-items:center;gap:1rem;margin-top:1.6rem;padding:1.3rem;background:var(--black2);border:1px solid var(--border2);border-radius:14px}
.course-buy-box .course-price-tag{font-size:1.3rem}
.course-buy-btn{padding:.8rem 1.4rem;background:var(--volt);color:var(--black);border:none;border-radius:9px;font-weight:700;font-family:var(--mono);font-size:.82rem;cursor:pointer}
.course-buy-btn:disabled{opacity:.6;cursor:not-allowed}
</style>\`;

app.get('/kurzy', async (req, res) => {
  try {
    const { data: courses } = await supabase.from('courses').select('slug,title,description,price_cents').eq('published', true).order('created_at', { ascending: false });
    const list = courses || [];
    const grid = list.length
      ? \`\${KURZY_STYLE}<div class="course-grid">\${list.map(courseCardHtml).join('')}</div>\`
      : \`\${KURZY_STYLE}<div class="empty-state">Zatiaľ tu nie sú žiadne kurzy.</div>\`;
    const body = \`<main class="page">
      <nav class="breadcrumb"><a href="/">SP Tréner</a><span>/</span><span>Kurzy</span></nav>
      <h1 class="hero-title">Video kurzy</h1>
      <p class="hero-sub">Teoretický doplnok k praktickým testom — video lekcie, materiály na stiahnutie a kvíz v každej lekcii.</p>
      \${grid}
    </main>\`;
    const jsonLd = {
      '@context': 'https://schema.org', '@type': 'ItemList',
      itemListElement: list.map((c, i) => ({ '@type': 'Course', position: i + 1, name: c.title, url: BASE_URL_BLOG + '/kurzy/' + c.slug }))
    };
    res.send(blogLayout({
      title: 'Video kurzy — SP Tréner',
      description: 'Video kurzy na prípravu k prijímacím testom — lekcie s videom, materiálmi na stiahnutie a kvízom po každej lekcii.',
      body, canonicalPath: '/kurzy', jsonLd: [jsonLd], lang: 'sk'
    }));
  } catch (e) {
    res.status(500).send('Chyba servera.');
  }
});

app.get('/kurzy/:slug', async (req, res) => {
  try {
    const { data: course } = await supabase.from('courses').select('*').eq('slug', req.params.slug).eq('published', true).single();
    if (!course) return res.status(404).send('Kurz sa nenašiel.');
    const { data: lessons } = await supabase.from('course_lessons').select('id,title,sort_order').eq('course_id', course.id).order('sort_order');
    const priceStr = (course.price_cents / 100).toFixed(2).replace('.', ',');
    const body = \`\${KURZY_STYLE}<main class="page">
      <nav class="breadcrumb"><a href="/">SP Tréner</a><span>/</span><a href="/kurzy">Kurzy</a><span>/</span><span>\${escapeHtml(course.title)}</span></nav>
      <h1 class="hero-title">\${escapeHtml(course.title)}</h1>
      <p class="hero-sub">\${escapeHtml(course.description || '')}</p>
      <ol class="course-lesson-outline">\${(lessons || []).map(l => \`<li>\${escapeHtml(l.title)}</li>\`).join('')}</ol>
      <div class="course-buy-box">
        <span class="course-price-tag">\${priceStr} €</span>
        <button class="course-buy-btn" data-slug="\${course.slug}" onclick="buyCourse(this)">Kúpiť kurz</button>
      </div>
    </main>
    <script>
    async function buyCourse(btn) {
      const email = prompt('Email, na ktorý si vytvoríš/máš účet SP Tréner:');
      if (!email) return;
      btn.disabled = true; btn.textContent = 'Chvíľu strpenia…';
      try {
        const res = await fetch('/api/courses/' + btn.dataset.slug + '/checkout', {
          method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.url) location.href = data.url;
        else { alert(data.error || 'Chyba pri vytváraní platby.'); btn.disabled = false; btn.textContent = 'Kúpiť kurz'; }
      } catch (e) { alert('Chyba servera.'); btn.disabled = false; btn.textContent = 'Kúpiť kurz'; }
    }
    <\/script>\`;
    const jsonLd = {
      '@context': 'https://schema.org', '@type': 'Course', name: course.title, description: course.description || course.title,
      provider: { '@type': 'Organization', name: 'SP Tréner', sameAs: BASE_URL_BLOG },
      offers: { '@type': 'Offer', price: priceStr.replace(',', '.'), priceCurrency: 'EUR', url: BASE_URL_BLOG + '/kurzy/' + course.slug, availability: 'https://schema.org/InStock' }
    };
    res.send(blogLayout({
      title: course.title + ' — SP Tréner',
      description: (course.description || course.title).slice(0, 160),
      body, canonicalPath: '/kurzy/' + course.slug, jsonLd: [jsonLd], lang: 'sk'
    }));
  } catch (e) {
    res.status(500).send('Chyba servera.');
  }
});

app.post('/api/courses/:slug/checkout', rateLimit, async (req, res) => {
  const { email } = req.body || {};
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Neplatný email.' });
  try {
    const { data: course } = await supabase.from('courses').select('*').eq('slug', req.params.slug).eq('published', true).single();
    if (!course) return res.status(404).json({ error: 'Kurz sa nenašiel.' });

    const { data: already } = await supabase.from('course_purchases').select('id').eq('course_id', course.id).eq('email', email).maybeSingle();
    if (already) return res.status(400).json({ error: 'Tento kurz už máš zakúpený.' });

    let customerId;
    const { data: user } = await supabase.from('users').select('stripe_customer_id').eq('email', email).single();
    if (user?.stripe_customer_id) {
      customerId = user.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({ email });
      customerId = customer.id;
      await supabase.from('users').upsert({ email, stripe_customer_id: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: course.price_cents,
          product_data: { name: course.title, description: (course.description || '').slice(0, 300) }
        },
        quantity: 1
      }],
      success_url: BASE_URL_BLOG + '/kurzy/' + course.slug + '/watch?payment=success',
      cancel_url: BASE_URL_BLOG + '/kurzy/' + course.slug + '?cancelled=1',
      locale: 'sk',
      metadata: { type: 'course_purchase', courseId: course.id, courseSlug: course.slug }
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('course checkout error:', err.message);
    res.status(500).json({ error: 'Chyba vytvorenia platby.' });
  }
});

async function requireCourseBuyer(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Prihlás sa.' });
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'Neplatná session.' });
    req.userEmail = data.user.email;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Neplatná session.' });
  }
}

app.get('/api/courses/:slug/access', requireCourseBuyer, async (req, res) => {
  try {
    const { data: course } = await supabase.from('courses').select('*').eq('slug', req.params.slug).single();
    if (!course) return res.status(404).json({ error: 'Kurz sa nenašiel.' });
    const { data: purchase } = await supabase.from('course_purchases').select('id').eq('course_id', course.id).eq('email', req.userEmail).maybeSingle();
    if (!purchase) return res.status(403).json({ error: 'Tento kurz nemáš zakúpený.' });

    const { data: lessons } = await supabase.from('course_lessons').select('*').eq('course_id', course.id).order('sort_order');
    const { data: progress } = await supabase.from('course_lesson_progress').select('lesson_id').eq('course_id', course.id).eq('email', req.userEmail);
    const completedIds = new Set((progress || []).map(p => p.lesson_id));

    let unlocked = true;
    const outLessons = (lessons || []).map(l => {
      const isUnlocked = unlocked;
      if (!completedIds.has(l.id)) unlocked = false;
      return {
        id: l.id, title: l.title, sortOrder: l.sort_order, completed: completedIds.has(l.id), unlocked: isUnlocked,
        videoUrl: isUnlocked ? l.video_url : null,
        docUrl: isUnlocked ? l.doc_url : null,
        quizQuestion: isUnlocked ? l.quiz_question : null,
        quizOptionA: isUnlocked ? l.quiz_option_a : null,
        quizOptionB: isUnlocked ? l.quiz_option_b : null,
        quizOptionC: isUnlocked ? l.quiz_option_c : null,
        quizOptionD: isUnlocked ? l.quiz_option_d : null
      };
    });
    res.json({ course: { title: course.title, slug: course.slug }, lessons: outLessons });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.post('/api/courses/:slug/lessons/:lessonId/answer', requireCourseBuyer, async (req, res) => {
  const { option } = req.body || {};
  if (!['a', 'b', 'c', 'd'].includes(option)) return res.status(400).json({ error: 'Neplatná odpoveď.' });
  try {
    const { data: course } = await supabase.from('courses').select('id').eq('slug', req.params.slug).single();
    if (!course) return res.status(404).json({ error: 'Kurz sa nenašiel.' });
    const { data: purchase } = await supabase.from('course_purchases').select('id').eq('course_id', course.id).eq('email', req.userEmail).maybeSingle();
    if (!purchase) return res.status(403).json({ error: 'Tento kurz nemáš zakúpený.' });

    const { data: lesson } = await supabase.from('course_lessons').select('*').eq('id', req.params.lessonId).eq('course_id', course.id).single();
    if (!lesson) return res.status(404).json({ error: 'Lekcia sa nenašla.' });

    const { data: allLessons } = await supabase.from('course_lessons').select('id,sort_order').eq('course_id', course.id).order('sort_order');
    const { data: progress } = await supabase.from('course_lesson_progress').select('lesson_id').eq('course_id', course.id).eq('email', req.userEmail);
    const completedIds = new Set((progress || []).map(p => p.lesson_id));
    const priorLessons = (allLessons || []).filter(l => l.sort_order < lesson.sort_order);
    if (priorLessons.some(l => !completedIds.has(l.id))) return res.status(403).json({ error: 'Najprv dokonči predchádzajúce lekcie.' });

    const correct = !lesson.quiz_correct || lesson.quiz_correct === option;
    if (correct) {
      await supabase.from('course_lesson_progress').upsert({
        course_id: course.id, lesson_id: lesson.id, email: req.userEmail
      }, { onConflict: 'course_id,lesson_id,email' });
    }
    const nextLesson = (allLessons || []).find(l => l.sort_order === lesson.sort_order + 1);
    res.json({ correct, nextLessonId: correct ? (nextLesson?.id || null) : null });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.get('/kurzy/:slug/watch', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kurz-watch.html'));
});

`;

const SITEMAP_OLD = `    const { data: posts } = await supabase.from('blog_posts').select('slug,created_at').eq('published', true);
    const urls = [
      { loc: BASE_URL_BLOG + '/', changefreq: 'weekly', priority: '1.0' },
      { loc: BASE_URL_BLOG + '/blog', changefreq: 'daily', priority: '0.8' },
      ...(posts || []).map(p => ({ loc: BASE_URL_BLOG + '/blog/' + p.slug, lastmod: p.created_at, changefreq: 'monthly', priority: '0.6' }))
    ];`;
const SITEMAP_NEW = `    const { data: posts } = await supabase.from('blog_posts').select('slug,created_at').eq('published', true);
    const { data: coursesForSitemap } = await supabase.from('courses').select('slug,created_at').eq('published', true);
    const urls = [
      { loc: BASE_URL_BLOG + '/', changefreq: 'weekly', priority: '1.0' },
      { loc: BASE_URL_BLOG + '/blog', changefreq: 'daily', priority: '0.8' },
      { loc: BASE_URL_BLOG + '/kurzy', changefreq: 'weekly', priority: '0.8' },
      ...(posts || []).map(p => ({ loc: BASE_URL_BLOG + '/blog/' + p.slug, lastmod: p.created_at, changefreq: 'monthly', priority: '0.6' })),
      ...(coursesForSitemap || []).map(c => ({ loc: BASE_URL_BLOG + '/kurzy/' + c.slug, lastmod: c.created_at, changefreq: 'monthly', priority: '0.7' }))
    ];`;
if (!src.includes(SITEMAP_OLD)) {
  console.error('Nenasiel som presny sitemap blok. Nic som nezmenil.');
  process.exit(1);
}

const patched = src.replace(WEBHOOK_OLD, WEBHOOK_NEW).replace(ANCHOR, KURZY_ROUTES + ANCHOR).replace(SITEMAP_OLD, SITEMAP_NEW);

const backup = FILE + '.pre-kurzy-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
