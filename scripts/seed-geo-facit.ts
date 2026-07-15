/**
 * Enrich Geografi frågor with facit/bedömningskriterier from UU bedömningsanvisningar.
 *
 * Usage:
 *   npx tsx scripts/seed-geo-facit.ts
 *   npx tsx scripts/seed-geo-facit.ts --dry-run
 *   npx tsx scripts/seed-geo-facit.ts --ak6-only
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';
import {
  parseGeoFacitEntries,
  facitMapFromEntries,
  facitForFraga,
  combinedAk6FacitSummary,
} from './lib/geo-facit-parse';

const dryRun = process.argv.includes('--dry-run');
const ak6Only = process.argv.includes('--ak6-only');
const ak9Only = process.argv.includes('--ak9-only');
const PROV_DIR = path.resolve('public/prov');

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const AK6_FACIT = [
  { year: 2013, slug: 'geo-ak6-2013', bed: 'geo-ak6-2013-bedomningsanvisningar.pdf' },
  { year: 2014, slug: 'geo-ak6-2014', bed: 'geo-ak6-2014-bedomningsanvisningar.pdf' },
  { year: 2015, slug: 'geo-ak6-2015', bed: 'geo-ak6-2015-bedomningsanvisningar.pdf' },
  { year: 2017, slug: 'geo-ak6-2017-msk', bed: 'geo-ak6-2017-msk-natur-bedomning.pdf' },
  { year: 2017, slug: 'geo-ak6-2017-global', bed: 'geo-ak6-2017-global-bedomning.pdf' },
] as const;

async function extractPdfText(filePath: string): Promise<string> {
  const buf = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

async function seedAk9Facit(year: number): Promise<number> {
  const bedFile = `geo-ak9-${year}-bedomningsanvisningar.pdf`;
  const bedPath = path.join(PROV_DIR, bedFile);
  if (!fs.existsSync(bedPath)) {
    console.warn(`  ⚠ Missing ${bedFile}`);
    return 0;
  }

  const text = await extractPdfText(bedPath);
  const entries = parseGeoFacitEntries(text);
  const facitMap = facitMapFromEntries(entries);
  const keys = Object.keys(facitMap);
  if (!keys.length) {
    console.warn(`  ⚠ No facit in ${bedFile}`);
    return 0;
  }

  const slug = `geo-ak9-${year}`;
  let { data: prov } = await supabase.from('prov').select('id').eq('slug', slug).maybeSingle();
  if (!prov?.id) {
    const { data: legacy } = await supabase.from('prov').select('id').eq('slug', 'a8f3c2e91b').maybeSingle();
    if (!legacy?.id) return 0;
    prov = legacy;
  }

  const updated = await applyFacitToProv(prov.id, year, text, entries, facitMap, 'ak9');
  console.log(`  ak9 ${year}: ${keys.length} uppgifter i facit-PDF, ~${updated} uppdaterade`);
  return updated;
}

async function seedAk6Facit(entry: (typeof AK6_FACIT)[number]): Promise<number> {
  const bedPath = path.join(PROV_DIR, entry.bed);
  if (!fs.existsSync(bedPath)) {
    console.warn(`  ⚠ Missing ${entry.bed}`);
    return 0;
  }

  const text = await extractPdfText(bedPath);
  const entries = parseGeoFacitEntries(text);
  const facitMap = facitMapFromEntries(entries);

  const { data: prov } = await supabase.from('prov').select('id').eq('slug', entry.slug).maybeSingle();
  if (!prov?.id) {
    console.warn(`  ⚠ Prov ${entry.slug} not in DB`);
    return 0;
  }

  if ('singleElevhafte' in entry && entry.singleElevhafte) {
    const summary = combinedAk6FacitSummary(entries);
    if (!summary) {
      console.warn(`  ⚠ No facit summary for ${entry.slug}`);
      return 0;
    }
    const { data: dps } = await supabase.from('delprov').select('id').eq('prov_id', prov.id);
    let updated = 0;
    for (const dp of dps || []) {
      const { data: fr } = await supabase.from('fraga').select('id, korrekt_svar').eq('delprov_id', dp.id);
      for (const f of fr || []) {
        if (f.korrekt_svar === summary) continue;
        if (!dryRun) {
          await supabase.from('fraga').update({ korrekt_svar: summary }).eq('id', f.id);
        }
        updated++;
      }
    }
    console.log(`  ak6 ${entry.slug}: elevhäfte-sammanfattning, ~${updated} uppdaterade`);
    return updated;
  }

  const updated = await applyFacitToProv(prov.id, entry.year, text, entries, facitMap, 'ak6');
  console.log(`  ak6 ${entry.year}: ${Object.keys(facitMap).length} uppgifter, ~${updated} uppdaterade`);
  return updated;
}

async function applyFacitToProv(
  provId: string,
  year: number,
  bedText: string,
  entries: ReturnType<typeof parseGeoFacitEntries>,
  facitMap: Record<number, string>,
  niva: 'ak9' | 'ak6'
): Promise<number> {
  const { data: yearDps } = await supabase
    .from('delprov')
    .select('id, beteckning')
    .eq('prov_id', provId);

  const dpA = yearDps?.find((d) => /Delprov A/i.test(d.beteckning));
  const dpB = yearDps?.find((d) => /Delprov B/i.test(d.beteckning));

  let aCount = 0;
  if (dpA) {
    const { count } = await supabase
      .from('fraga')
      .select('*', { count: 'exact', head: true })
      .eq('delprov_id', dpA.id);
    aCount = count || 0;
  }

  let updated = 0;
  for (const dp of yearDps || []) {
    const letter: 'A' | 'B' =
      dpB && dp.id === dpB.id ? 'B' : /Delprov B/i.test(dp.beteckning) && !/Delprov A/i.test(dp.beteckning) ? 'B' : 'A';
    const { data: fragor } = await supabase
      .from('fraga')
      .select('id, fraga_nummer, text, korrekt_svar')
      .eq('delprov_id', dp.id);

    for (const f of fragor || []) {
      const facit = facitForFraga(
        f.text || '',
        f.fraga_nummer,
        year,
        letter,
        aCount,
        facitMap,
        entries,
        bedText,
        niva
      );
      if (!facit || f.korrekt_svar === facit) continue;
      if (!dryRun) {
        await supabase.from('fraga').update({ korrekt_svar: facit.slice(0, 4000) }).eq('id', f.id);
      }
      updated++;
    }
  }
  return updated;
}

async function main() {
  console.log(dryRun ? '🧪 Dry-run geo facit…' : '✅ Seeding Geografi facit…');
  let updated = 0;

  if (!ak6Only) {
    for (let year = 2013; year <= 2018; year++) {
      updated += await seedAk9Facit(year);
    }
  }

  if (!ak9Only) {
    for (const entry of AK6_FACIT) {
      updated += await seedAk6Facit(entry);
    }
  }

  console.log(`\n✅ Geo facit done. Updated ~${updated} frågor.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});