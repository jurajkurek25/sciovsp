// DIAGNOSTICKY skript -- NIC NEMENI (len číta z DB, nič nezapisuje).
// Aby som mohol zmysluplne zaradiť existujúce kurzy do kategórií
// (main-app-patches, ktorý pridá stĺpec courses.category), potrebujem
// vidieť ich skutočné názvy a popisy -- nemám k nim inak prístup.
//
// Zároveň (v tom istom behu) vypíše aj skutočné distinct tagy z
// blog_posts, aby kategórie na /blog sedeli na to, čo je naozaj v DB,
// nie na to, čo som videl v starých seed skriptoch.
//
// Spusti z korena hlavnej appky a pošli mi CELÝ výpis:
//   node main-app-patches/207-diag-courses-list.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ Chýba SUPABASE_URL alebo SUPABASE_SERVICE_KEY v .env.');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Chyba pri čítaní z courses:', error.message);
    process.exit(1);
  }

  console.log('Počet kurzov:', (data || []).length);
  console.log('');
  (data || []).forEach((c, i) => {
    console.log('--- kurz ' + (i + 1) + ' ---');
    console.log(JSON.stringify(c, null, 2));
    console.log('');
  });

  const { data: posts, error: postsError } = await supabase
    .from('blog_posts')
    .select('tag,tag_cs')
    .eq('published', true);

  if (postsError) {
    console.error('❌ Chyba pri čítaní z blog_posts:', postsError.message);
  } else {
    const skTags = [...new Set((posts || []).map(p => p.tag).filter(Boolean))].sort();
    const csTags = [...new Set((posts || []).map(p => p.tag_cs).filter(Boolean))].sort();
    console.log('=== distinct blog_posts.tag (SK), ' + skTags.length + ' ===');
    console.log(JSON.stringify(skTags));
    console.log('');
    console.log('=== distinct blog_posts.tag_cs (CZ), ' + csTags.length + ' ===');
    console.log(JSON.stringify(csTags));
    console.log('');
  }

  console.log('Skopíruj CELÝ výpis vyššie a pošli mi ho.');
})();
