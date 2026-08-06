// Autonómny AI ops runner — naprieč appkami, ale s pevne daným whitelistom
// akcií, ktoré smie vykonať sám, a KAŽDÁ akcia sa loguje do
// dash_ai_actions_log (action_type, reasoning, result, detail), nech
// dopadne akokoľvek. Nič mimo whitelistu sa nevykoná.
//
// Platby: aiops smie automaticky vygenerovať PAY by square QR pre výber,
// ktorý sám vyhodnotí ako "pripravený na vyplatenie" (payout_qr_prepared),
// ale NIKDY ho neoznačí za vyplatený — to vyžaduje, aby Juraj sám naskenoval
// QR vo svojej bankovej appke a potvrdil prevod, a potom ručne klikol
// "označiť ako vyplatené" v UI. Žiadny kód tu nemá prístup k bankovému účtu.
const express = require('express');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase } = require('../lib/db-partner');
const { supabase: mainDb } = require('../lib/db-main');
const { callClaude } = require('../lib/claude');

const AUTO_PUBLISH_BLOG = process.env.DASH_AUTO_PUBLISH_BLOG !== 'false'; // default true — user explicitly asked for automatic publisher
const PAYOUT_READY_THRESHOLD_EUR = Number(process.env.DASH_PAYOUT_READY_THRESHOLD_EUR) || 20;

async function logAction({ actionType, targetSystem, targetId, reasoning, result, detail }) {
  try {
    await supabase.from('dash_ai_actions_log').insert({
      action_type: actionType, target_system: targetSystem, target_id: targetId ? String(targetId) : null,
      reasoning, result, detail: detail || null
    });
  } catch {
    // logovanie AI akcie nesmie zhodiť samotnú akciu
  }
}

async function runBlogTrendPublisher() {
  try {
    const { data: allTagged, error: tagErr } = await mainDb.from('blog_posts').select('tag, created_at').not('tag', 'is', null).limit(2000);
    if (tagErr) throw new Error(tagErr.message);
    const byTag = {};
    for (const row of allTagged || []) {
      const t = byTag[row.tag] || { tag: row.tag, n: 0, last_at: null };
      t.n += 1;
      if (!t.last_at || row.created_at > t.last_at) t.last_at = row.created_at;
      byTag[row.tag] = t;
    }
    const tagRows = Object.values(byTag).sort((a, b) => (a.last_at || '').localeCompare(b.last_at || '')).slice(0, 8);

    const { data: recentTitles, error: titlesErr } = await mainDb.from('blog_posts')
      .select('title, tag').order('created_at', { ascending: false }).limit(12);
    if (titlesErr) throw new Error(titlesErr.message);

    const system = `Si obsahový editor blogu SP Tréner (príprava na VŠP/SCIO prijímacie testy pre SR/ČR stredoškolákov). Na základe zoznamu tém/tagov, ktoré sa dlho nepokrývali, a nedávnych titulkov (aby si sa neopakoval), navrhni JEDEN nový blogový článok.

Dlho nepokryté tagy: ${JSON.stringify(tagRows)}
Nedávne články (neopakuj tému): ${JSON.stringify(recentTitles)}

Odpovedz IBA validným JSON objektom (žiadny iný text) v tvare:
{"title":"...", "slug":"kebab-case-slug-bez-diakritiky", "excerpt":"1-2 vety", "content":"plnohodnotný HTML článok, min 4 odseky, slovensky", "tag":"jeden z existujúcich alebo nový vhodný tag", "readTime":"X min čítania"}`;

    const raw = await callClaude({ system, messages: [{ role: 'user', content: 'Navrhni článok.' }], maxTokens: 2500 });
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI nevrátila platný JSON.');
    const draft = JSON.parse(jsonMatch[0]);
    if (!draft.title || !draft.slug || !draft.content) throw new Error('AI návrh chýba povinné polia.');

    const { data: existing, error: existingErr } = await mainDb.from('blog_posts').select('id').eq('slug', draft.slug);
    if (existingErr) throw new Error(existingErr.message);
    const slug = (existing || []).length ? `${draft.slug}-${Date.now().toString(36)}` : draft.slug;

    const { data: inserted, error: insertErr } = await mainDb.from('blog_posts').insert({
      slug, title: draft.title, excerpt: draft.excerpt || '', content: draft.content,
      tag: draft.tag || null, read_time: draft.readTime || null, published: AUTO_PUBLISH_BLOG
    }).select().single();
    if (insertErr) throw new Error(insertErr.message);

    await logAction({
      actionType: AUTO_PUBLISH_BLOG ? 'blog_draft_published' : 'blog_draft_created',
      targetSystem: 'main', targetId: inserted.id,
      reasoning: `Tag/téma "${draft.tag}" sa dlho nepokrývala (najstarší dlho-nepokrytý tag z DB). AI vygenerovala nový článok a ${AUTO_PUBLISH_BLOG ? 'rovno ho publikovala' : 'uložila ako draft na schválenie'}.`,
      result: 'success', detail: { slug, title: draft.title, tag: draft.tag }
    });
    return { ok: true, slug, title: draft.title, published: AUTO_PUBLISH_BLOG };
  } catch (err) {
    await logAction({ actionType: 'blog_draft_published', targetSystem: 'main', reasoning: 'Pokus o automatický blog článok zlyhal.', result: 'failed', detail: { error: err.message } });
    return { ok: false, error: err.message };
  }
}

async function runPayoutReadyFlagger() {
  try {
    const { data: pending } = await supabase.from('partner_payouts')
      .select('id, amount, iban, requested_at, partners(first_name, last_name)').eq('status', 'pending');
    const ready = (pending || []).filter(p => Number(p.amount) >= PAYOUT_READY_THRESHOLD_EUR && p.iban);
    for (const p of ready) {
      const name = p.partners ? `${p.partners.first_name} ${p.partners.last_name}` : p.id;
      await logAction({
        actionType: 'payout_qr_prepared', targetSystem: 'partner', targetId: p.id,
        reasoning: `Výber ${p.amount}€ pre ${name} má IBAN a presahuje prah ${PAYOUT_READY_THRESHOLD_EUR}€ — pripravený na vyplatenie. AI QR nevytvára prevod, iba ho pripravuje na sken v bankovej appke.`,
        result: 'success', detail: { amount: p.amount, partner: name }
      });
    }
    return { ok: true, flagged: ready.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

router.post('/api/dash/aiops/run', requireDashAuth, async (req, res) => {
  const { tasks } = req.body || {};
  const want = (t) => !tasks || tasks.includes(t);
  const results = {};
  if (want('blog')) results.blog = await runBlogTrendPublisher();
  if (want('payouts')) results.payouts = await runPayoutReadyFlagger();
  res.json({ ok: true, results });
});

router.get('/api/dash/aiops/log', requireDashAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const { data, error } = await supabase.from('dash_ai_actions_log').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ actions: data || [] });
});

module.exports = router;
