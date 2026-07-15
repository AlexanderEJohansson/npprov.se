/**
 * Enrich seeded gymnasium-Ma frågor with facit from bedömningsanvisningar in the same PDF.
 *
 * Usage:
 *   npx tsx scripts/seed-ma-facit.ts
 *   npx tsx scripts/seed-ma-facit.ts --dry-run
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';
import {
  parseFacitMap,
  matchFlervalAnswer,
} from './lib/ma-parse';

const dryRun = process.argv.includes('--dry-run');
const PROV_DIR = path.resolve('public/prov');

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GYM_MA_PDFS = fs
  .readdirSync(PROV_DIR)
  .filter((f) => /^Ma\d[a-z]?-(vt|ht)\d{2}\.pdf$/i.test(f));

async function extractPdfText(filePath: string): Promise<string> {
  const buf = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

async function main() {
  console.log(dryRun ? '🧪 Dry-run Ma facit…' : '✅ Seeding Ma facit from bedömningsanvisningar…');

  let updated = 0;

  for (const filename of GYM_MA_PDFS.sort()) {
    const { data: provRows } = await supabase
      .from('prov')
      .select('id, slug')
      .or(`pdf_url.eq./prov/${filename},metadata->>original_filename.eq.${filename}`)
      .limit(1);

    const provRow = provRows?.[0];
    if (!provRow) {
      console.warn(`  ⚠ No prov for ${filename}`);
      continue;
    }

    const text = await extractPdfText(path.join(PROV_DIR, filename));
    const facitMap = parseFacitMap(text);
    const keys = Object.keys(facitMap);
    if (!keys.length) {
      console.warn(`  ⚠ No facit parsed: ${filename}`);
      continue;
    }

    const { data: dps } = await supabase.from('delprov').select('id').eq('prov_id', provRow.id);
    const dpIds = (dps || []).map((d) => d.id);
    if (!dpIds.length) continue;

    const { data: fragor } = await supabase
      .from('fraga')
      .select('id, fraga_nummer, typ, svarsalternativ_json, korrekt_svar')
      .in('delprov_id', dpIds);

    let provUpdated = 0;
    for (const f of fragor || []) {
      const facit = facitMap[f.fraga_nummer];
      if (!facit) continue;

      const korrekt =
        f.typ === 'flerval' && f.svarsalternativ_json
          ? matchFlervalAnswer(facit, f.svarsalternativ_json as { id: string; text: string }[])
          : facit;

      if (f.korrekt_svar === korrekt) continue;

      if (!dryRun) {
        await supabase.from('fraga').update({ korrekt_svar: korrekt }).eq('id', f.id);
      }
      provUpdated++;
    }

    if (provUpdated > 0) {
      console.log(`→ ${provRow.slug}: ${provUpdated} frågor fick facit (${keys.length} facit-rader i PDF)`);
      updated += provUpdated;
    }
  }

  // Facit from ZIP bedömnings-PDFs (Ma 1a/b/c)
  const zipTargets = fs
    .readdirSync(PROV_DIR)
    .filter((f) => /^Ma 1[a-c] VT (2017|2022)/i.test(f) && f.endsWith('.zip'));

  for (const zipFile of zipTargets.sort()) {
    const { data: provRows } = await supabase
      .from('prov')
      .select('id, slug')
      .eq('metadata->>original_filename', zipFile)
      .limit(1);

    const provRow = provRows?.[0];
    if (!provRow) continue;

    const tmpDir = path.join('.tmp', 'facit-zip', zipFile.replace(/\.zip$/i, ''));
    const patterns = JSON.stringify(['anvisning', 'bedo']);
    try {
      execFileSync('python3', [
        'scripts/extract-zip-pdfs.py',
        path.join(PROV_DIR, zipFile),
        tmpDir,
        patterns,
      ], { encoding: 'utf-8' });
    } catch {
      continue;
    }

    const bedPdfs = fs
      .readdirSync(tmpDir)
      .filter((f) => /anvisning|bedo/i.test(f) && f.endsWith('.pdf'))
      .sort();
    if (!bedPdfs.length) continue;

    const facitMap: Record<string, string> = {};
    for (const bedPdf of bedPdfs) {
      Object.assign(facitMap, parseFacitMap(await extractPdfText(path.join(tmpDir, bedPdf))));
    }
    if (!Object.keys(facitMap).length) continue;

    const { data: dps } = await supabase.from('delprov').select('id').eq('prov_id', provRow.id);
    const dpIds = (dps || []).map((d) => d.id);
    const { data: fragor } = await supabase
      .from('fraga')
      .select('id, fraga_nummer, typ, svarsalternativ_json, korrekt_svar')
      .in('delprov_id', dpIds);

    let provUpdated = 0;
    for (const f of fragor || []) {
      const facit = facitMap[f.fraga_nummer];
      if (!facit) continue;
      const korrekt =
        f.typ === 'flerval' && f.svarsalternativ_json
          ? matchFlervalAnswer(facit, f.svarsalternativ_json as { id: string; text: string }[])
          : facit;
      if (f.korrekt_svar === korrekt) continue;
      if (!dryRun) await supabase.from('fraga').update({ korrekt_svar: korrekt }).eq('id', f.id);
      provUpdated++;
    }

    if (provUpdated > 0) {
      console.log(
        `→ ${provRow.slug} (ZIP): ${provUpdated} frågor fick facit (${bedPdfs.length} bed-PDF:er, ${Object.keys(facitMap).length} facit-rader)`
      );
      updated += provUpdated;
    }
  }

  console.log(`\n✅ Facit klar. Uppdaterade ${updated} frågor.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});