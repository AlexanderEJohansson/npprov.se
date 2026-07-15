/**
 * Ping IndexNow with npprov.se URLs (geo frågor + prov pages).
 *
 * Usage:
 *   npx tsx scripts/indexnow-ping.ts
 *   npx tsx scripts/indexnow-ping.ts --geo-only
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const geoOnly = process.argv.includes('--geo-only');
const SITE = 'https://npprov.se';
const KEY = process.env.INDEXNOW_KEY || 'npprov-indexnow-key';
const KEY_LOCATION = `${SITE}/${KEY}.txt`;

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function collectUrls(): Promise<string[]> {
  const urls = [`${SITE}/`, `${SITE}/prov`, `${SITE}/genome`, `${SITE}/kallor`];

  let provQuery = supabase.from('prov').select('slug').eq('amne', 'Geografi');
  if (geoOnly) {
    const { data: provs } = await provQuery;
    for (const p of provs || []) {
      if (p.slug) urls.push(`${SITE}/prov/${p.slug}`);
    }
    const { data: fragor } = await supabase
      .from('fraga')
      .select('id, delprov:delprov_id(prov:prov_id(slug, amne))')
      .limit(500);
    for (const f of fragor || []) {
      const slug = f.delprov?.prov?.slug;
      if (slug && f.delprov?.prov?.amne === 'Geografi') {
        urls.push(`${SITE}/prov/${slug}/fraga/${f.id}`);
      }
    }
  } else {
    const { data: provs } = await supabase.from('prov').select('slug').limit(120);
    for (const p of provs || []) {
      if (p.slug) urls.push(`${SITE}/prov/${p.slug}`);
    }
  }

  return [...new Set(urls)];
}

async function main() {
  const urlList = await collectUrls();
  console.log(`📡 IndexNow ping: ${urlList.length} URLs`);

  const body = {
    host: 'npprov.se',
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: urlList.slice(0, 10000),
  };

  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  console.log(res.ok ? `✅ IndexNow ${res.status}` : `⚠️ IndexNow ${res.status}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});