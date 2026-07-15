/**
 * Remove parser-junk GEO frågor and fix mis-parsed titles.
 *
 * Usage: npx tsx scripts/cleanup-geo-junk.ts [--dry-run]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { isGeoJunkFraga } from './lib/geo-parse';

const dryRun = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log(dryRun ? '🧪 Dry-run geo junk cleanup…' : '🧹 Cleaning GEO junk frågor…');

  const { data: geoProvs } = await supabase.from('prov').select('id, slug').eq('amne', 'Geografi');
  const provMap = new Map((geoProvs || []).map((p) => [p.id, p.slug]));
  const { data: dps } = await supabase
    .from('delprov')
    .select('id, beteckning, prov_id')
    .in('prov_id', (geoProvs || []).map((p) => p.id));
  const dpIds = (dps || []).map((d) => d.id);

  const { data: fragor } = await supabase
    .from('fraga')
    .select('id, text, delprov_id')
    .in('delprov_id', dpIds);

  let deleted = 0;
  for (const f of fragor || []) {
    if (!isGeoJunkFraga(f.text || '')) continue;
    const dp = dps?.find((d) => d.id === f.delprov_id);
    const slug = provMap.get(dp?.prov_id || '') || '?';
    console.log(`  ✗ ${slug} ${dp?.beteckning}: ${f.text?.slice(0, 55)}…`);
    if (!dryRun) {
      await supabase.from('fraga_kunskapsmal').delete().eq('fraga_id', f.id);
      await supabase.from('fraga').delete().eq('id', f.id);
    }
    deleted++;
  }

  console.log(`\n✅ GEO junk cleanup done. ${deleted} rader borttagna.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});