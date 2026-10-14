// SEO vylepsenia pre affiliate systém (/odporucame):
// 1) Karty produktov teraz odkazuju na vlastnu /go/:id cestu namiesto
//    priameho ehub.cz odkazu v HTML — cistejsie na spravu (zmena destinacie
//    bez patchu do server.js) a v zdrojaku to nevyzera ako "holy affiliate
//    spam". Nova /go/:id routa spravi 302 redirect na skutocny affiliate
//    odkaz z DB. rel="sponsored noopener" ostava na karte, robots.txt
//    (patch 149) zakazuje crawlovanie /go/.
// 2) Struktorovane data (schema.org ItemList) pre /odporucame, aby mal
//    Google jasny signal o obsahu stranky (moze pomoct rich snippets).
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.150-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("app.get('/go/:id'")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, () => newStr);
}

let patched = src;

// -- 1) Karty: href cez /go/:id namiesto priameho odkazu --
patched = replaceOnce(patched,
  '    <a class="course-card" href="${escapeHtml(p.url)}" target="_blank" rel="sponsored noopener">',
  '    <a class="course-card" href="/go/${p.id}" target="_blank" rel="sponsored noopener">',
  '1: course-card href -> /go/:id');

// -- 2) ItemList JSON-LD, postavene pred ODPORUCAME_STYLE --
patched = replaceOnce(patched,
  '    const ODPORUCAME_STYLE = `<style>',
  `    const itemListJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: (products || []).map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: isCz ? p.title_cs : p.title_sk,
        url: BASE_URL_BLOG + '/go/' + p.id
      }))
    };
    const ODPORUCAME_STYLE = \`<style>`,
  '2: itemListJsonLd construction');

// -- 3) res.send: pridat jsonLd param + pridat /go/:id routu za koniec handlera --
const OLD_TAIL = `    res.send(blogLayout({
      title: isCz ? 'Doporučujeme — SP Tréner' : 'Odporúčame — SP Tréner',
      description: isCz ? 'Ověřené věci pro uchazeče o vysokou školu — batohy, ubytování a další doporučení.' : 'Overené veci pre uchádzačov o vysokú školu — batohy, ubytovanie a ďalšie odporúčania.',
      body,
      canonicalPath: '/odporucame',
      lang: l
    }));
  } catch (e) {
    console.error('odporucame error:', e.message);
    res.status(500).send('Chyba servera.');
  }
});`;
const NEW_TAIL = `    res.send(blogLayout({
      title: isCz ? 'Doporučujeme — SP Tréner' : 'Odporúčame — SP Tréner',
      description: isCz ? 'Ověřené věci pro uchazeče o vysokou školu — batohy, ubytování a další doporučení.' : 'Overené veci pre uchádzačov o vysokú školu — batohy, ubytovanie a ďalšie odporúčania.',
      body,
      canonicalPath: '/odporucame',
      jsonLd: [itemListJsonLd],
      lang: l
    }));
  } catch (e) {
    console.error('odporucame error:', e.message);
    res.status(500).send('Chyba servera.');
  }
});

app.get('/go/:id', async (req, res) => {
  try {
    const { data: product } = await supabase.from('affiliate_products').select('url,active').eq('id', req.params.id).single();
    if (!product || !product.active) return res.redirect(302, '/odporucame');
    res.redirect(302, product.url);
  } catch (e) {
    res.redirect(302, '/odporucame');
  }
});`;
patched = replaceOnce(patched, OLD_TAIL, NEW_TAIL, '3: res.send jsonLd + /go/:id route');

const backup = FILE + '.pre-affiliate-go-redirect-and-jsonld-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
