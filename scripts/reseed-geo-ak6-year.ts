/**
 * Re-seed Geografi åk 6 frågor for one läsår.
 *
 * Usage:
 *   npx tsx scripts/reseed-geo-ak6-year.ts --year 2013
 *   npx tsx scripts/reseed-geo-ak6-year.ts --year 2013 --delprov A --dry-run
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';
import { geoKunskapsmalForText, resolveGeoAk6Parser } from './lib/geo-parse';
import { sanitizeDbText, sanitizePdfText } from './lib/sanitize-text';

const dryRun = process.argv.includes('--dry-run');
const yearIdx = process.argv.indexOf('--year');
const yearArg =
  process.argv.find((a) => a.startsWith('--year='))?.split('=')[1] ??
  (yearIdx >= 0 ? process.argv[yearIdx + 1] : undefined);
const delprovIdx = process.argv.indexOf('--delprov');
const delprovFilter = (
  process.argv.find((a) => a.startsWith('--delprov='))?.split('=')[1] ??
  (delprovIdx >= 0 ? process.argv[delprovIdx + 1] : undefined)
)?.toUpperCase();

if (!yearArg || !/^\d{4}$/.test(yearArg)) {
  console.error('Usage: npx tsx scripts/reseed-geo-ak6-year.ts --year 2013 [--delprov A] [--dry-run]');
  process.exit(1);
}

const YEAR = Number(yearArg);
const PROV_DIR = path.resolve('public/prov');
const slugArg = process.argv.find((a) => a.startsWith('--slug='))?.split('=')[1];
const slug =
  slugArg ||
  (YEAR === 2017 && process.argv.includes('--msk')
    ? 'geo-ak6-2017-msk'
    : YEAR === 2017 && process.argv.includes('--global')
      ? 'geo-ak6-2017-global'
      : `geo-ak6-${YEAR}`);

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function extractPdfText(filePath: string): Promise<string> {
  const buf = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  await parser.destroy();
  return sanitizePdfText(result.text);
}

async function replaceFragaForDelprov(
  delprovId: string,
  seeds: {
    fraga_nummer: string;
    typ: string;
    text: string;
    vanliga_missforstand?: string;
    varfor_viktig?: string;
    max_poang?: number;
    kalla?: string;
  }[]
) {
  if (dryRun) {
    console.log(`  🧪 Would replace ${seeds.length} frågor on delprov ${delprovId}`);
    return;
  }

  const { data: existing } = await supabase.from('fraga').select('id').eq('delprov_id', delprovId);
  const ids = (existing || []).map((f) => f.id);
  if (ids.length) {
    await supabase.from('fraga_kunskapsmal').delete().in('fraga_id', ids);
    await supabase.from('fraga').delete().eq('delprov_id', delprovId);
  }

  for (const seed of seeds) {
    const row = {
      delprov_id: delprovId,
      fraga_nummer: seed.fraga_nummer,
      typ: seed.typ,
      text: sanitizeDbText(seed.text) || seed.fraga_nummer,
      vanliga_missforstand: sanitizeDbText(seed.vanliga_missforstand),
      varfor_viktig: sanitizeDbText(seed.varfor_viktig),
      max_poang: seed.max_poang,
      kalla: sanitizeDbText(seed.kalla),
      human_reviewed: false,
    };
    const { data: inserted, error } = await supabase.from('fraga').insert(row).select('id').single();
    if (error) throw new Error(`insert ${seed.fraga_nummer}: ${error.message}`);

    const kod = geoKunskapsmalForText(seed.text);
    const { data: km } = await supabase.from('kunskapsmal').select('id').eq('kod', kod).single();
    if (km?.id && inserted?.id) {
      await supabase.from('fraga_kunskapsmal').upsert(
        {
          fraga_id: inserted.id,
          kunskapsmal_id: km.id,
          styrka: 0.8,
          kommentar: `Automatisk koppling från reseed-geo-ak6-year ${YEAR}`,
          added_by: 'reseed-geo-ak6-year',
        },
        { onConflict: 'fraga_id,kunskapsmal_id' }
      );
    }
  }
}

async function main() {
  console.log(dryRun ? `🧪 Dry-run reseed ${slug}…` : `🌍 Reseeding ${slug}…`);

  const { data: prov } = await supabase.from('prov').select('id').eq('slug', slug).maybeSingle();
  if (!prov?.id) throw new Error(`Prov not found: ${slug}`);

  const letters = delprovFilter ? [delprovFilter] : (['A', 'B'] as const);
  let total = 0;

  const isElevhafte = slug.includes('2017-');
  const workItems = isElevhafte
    ? [
        {
          file:
            slug === 'geo-ak6-2017-global'
              ? 'geo-ak6-2017-global-elevhäfte.pdf'
              : 'geo-ak6-2017-msk-natur-elevhäfte.pdf',
          beteckning: 'Elevhäfte',
        },
      ]
    : letters.map((letter) => ({
        file: `geo-ak6-${YEAR}-delprov-${letter.toLowerCase()}.pdf`,
        beteckning: `Delprov ${letter}`,
      }));

  for (const { file, beteckning } of workItems) {
    const pdfPath = path.join(PROV_DIR, file);
    if (!fs.existsSync(pdfPath)) {
      console.warn(`  ⚠ Missing ${file}`);
      continue;
    }
    const { data: dp } = await supabase
      .from('delprov')
      .select('id')
      .eq('prov_id', prov.id)
      .eq('beteckning', beteckning)
      .maybeSingle();
    if (!dp?.id) throw new Error(`Delprov not found: ${beteckning}`);

    const text = await extractPdfText(pdfPath);
    const parse = resolveGeoAk6Parser(file, YEAR === 2017 && isElevhafte ? 2017 : YEAR);
    const seeds = parse(text);
    if (!seeds.length) {
      console.warn(`  ⚠ 0 frågor in ${file}`);
      continue;
    }

    console.log(`  ${beteckning}: ${seeds.length} frågor från ${file}`);
    seeds.forEach((s) => console.log(`    ${s.fraga_nummer}: ${s.text.slice(0, 55)}…`));
    await replaceFragaForDelprov(dp.id, seeds);
    total += seeds.length;
  }

  console.log(`\n✅ Reseed ${slug} done. ${total} frågor.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});