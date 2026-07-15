/**
 * One-time GEO metadata cleanup:
 * - Prov title/källa for 2013–2018 archive
 * - delprov.pdf_url per year/letter
 * - Remove bogus zip_url
 * - Deduplicate fraga_kunskapsmal for geo frågor
 * - Set human_reviewed: false on auto-parsed geo frågor
 *
 * Usage: npx tsx scripts/fix-geo-metadata.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const GEO_SLUG = 'a8f3c2e91b';
const UU_GEO_URL = 'https://www.uu.se/nationella-prov/geografi/aldre-prov-och-bedomningsstod';

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function pdfUrlForDelprov(beteckning: string): string | null {
  const m = beteckning.match(/Delprov ([AB]) \((\d{4})\)/i);
  if (!m) return null;
  return `/prov/geo-ak9-${m[2]}-delprov-${m[1].toLowerCase()}.pdf`;
}

async function main() {
  console.log('🌍 Fixing GEO metadata…');

  const { data: prov } = await supabase.from('prov').select('id').eq('slug', GEO_SLUG).single();
  if (!prov) throw new Error(`Prov ${GEO_SLUG} not found`);

  const { error: provErr } = await supabase
    .from('prov')
    .update({
      titel: 'Geografi åk 9 (2013–2018)',
      ar: 2018,
      kalla: 'Uppsala universitet',
      kalla_url: UU_GEO_URL,
      zip_url: null,
      metadata: {
        ar_span: '2013–2018',
        antal_lasar: 6,
        vard: 'arkiv',
      },
    })
    .eq('id', prov.id);
  if (provErr) throw provErr;
  console.log('  ✓ prov title, källa, zip_url cleared');

  const { data: delprov } = await supabase.from('delprov').select('id, beteckning').eq('prov_id', prov.id);
  let linked = 0;
  for (const dp of delprov || []) {
    const url = pdfUrlForDelprov(dp.beteckning);
    if (!url) continue;
    await supabase.from('delprov').update({ pdf_url: url }).eq('id', dp.id);
    linked++;
  }
  console.log(`  ✓ delprov.pdf_url set on ${linked} rows`);

  const delprovIds = (delprov || []).map((d) => d.id);
  const { data: fragor } = await supabase.from('fraga').select('id').in('delprov_id', delprovIds);
  const fragaIds = (fragor || []).map((f) => f.id);

  if (fragaIds.length) {
    const { count } = await supabase
      .from('fraga')
      .update({ human_reviewed: false })
      .in('id', fragaIds)
      .select('*', { count: 'exact', head: true });
    console.log(`  ✓ human_reviewed: false on ${count ?? fragaIds.length} geo frågor`);
  }

  if (fragaIds.length) {
    const { data: junctions } = await supabase
      .from('fraga_kunskapsmal')
      .select('id, fraga_id, kunskapsmal_id')
      .in('fraga_id', fragaIds);

    const seen = new Map<string, string>();
    const toDelete: string[] = [];
    for (const j of junctions || []) {
      const key = `${j.fraga_id}:${j.kunskapsmal_id}`;
      if (seen.has(key)) toDelete.push(j.id);
      else seen.set(key, j.id);
    }
    if (toDelete.length) {
      await supabase.from('fraga_kunskapsmal').delete().in('id', toDelete);
      console.log(`  ✓ removed ${toDelete.length} duplicate junctions`);
    } else {
      console.log('  ✓ no duplicate junctions');
    }
  }

  console.log('\n✅ GEO metadata fix complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});