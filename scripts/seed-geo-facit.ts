/**
 * Enrich Geografi frågor with facit/bedömningskriterier from UU bedömningsanvisningar.
 *
 * Usage:
 *   npx tsx scripts/seed-geo-facit.ts
 *   npx tsx scripts/seed-geo-facit.ts --dry-run
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';
import { parseGeoFacitEntries, facitMapFromEntries, geoUppgiftId } from './lib/geo-facit-parse';

const dryRun = process.argv.includes('--dry-run');
const PROV_DIR = path.resolve('public/prov');

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function extractPdfText(filePath: string): Promise<string> {
  const buf = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

async function main() {
  console.log(dryRun ? '🧪 Dry-run geo facit…' : '✅ Seeding Geografi facit…');
  let updated = 0;

  for (let year = 2013; year <= 2018; year++) {
    const bedFile = `geo-ak9-${year}-bedomningsanvisningar.pdf`;
    const bedPath = path.join(PROV_DIR, bedFile);
    if (!fs.existsSync(bedPath)) {
      console.warn(`  ⚠ Missing ${bedFile}`);
      continue;
    }

    const text = await extractPdfText(bedPath);
    const facitMap = facitMapFromEntries(parseGeoFacitEntries(text));
    const keys = Object.keys(facitMap);
    if (!keys.length) {
      console.warn(`  ⚠ No facit in ${bedFile}`);
      continue;
    }

    const slug = `geo-ak9-${year}`;
    let { data: prov } = await supabase.from('prov').select('id').eq('slug', slug).maybeSingle();
    if (!prov?.id) {
      const { data: legacy } = await supabase.from('prov').select('id').eq('slug', 'a8f3c2e91b').maybeSingle();
      if (!legacy?.id) continue;
      prov = legacy;
    }
    const provId = prov.id;

    const { data: yearDps } = await supabase
      .from('delprov')
      .select('id, beteckning')
      .eq('prov_id', provId);

    const dpA = yearDps.find((d) => /Delprov A/i.test(d.beteckning));
    const dpB = yearDps.find((d) => /Delprov B/i.test(d.beteckning));

    let aCount = 0;
    if (dpA) {
      const { count } = await supabase
        .from('fraga')
        .select('*', { count: 'exact', head: true })
        .eq('delprov_id', dpA.id);
      aCount = count || 0;
    }

    for (const dp of yearDps) {
      const letter = /Delprov B/i.test(dp.beteckning) ? 'B' : 'A';
      const { data: fragor } = await supabase
        .from('fraga')
        .select('id, fraga_nummer, korrekt_svar')
        .eq('delprov_id', dp.id);

      for (const f of fragor || []) {
        const uppgiftId = geoUppgiftId(year, letter as 'A' | 'B', f.fraga_nummer, aCount);
        if (!uppgiftId) continue;
        const facit = facitMap[uppgiftId];
        if (!facit || f.korrekt_svar === facit) continue;
        if (!dryRun) {
          await supabase.from('fraga').update({ korrekt_svar: facit.slice(0, 4000) }).eq('id', f.id);
        }
        updated++;
      }
    }

    console.log(`  ${year}: ${keys.length} uppgifter i facit-PDF`);
  }

  console.log(`\n✅ Geo facit done. Updated ~${updated} frågor.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});