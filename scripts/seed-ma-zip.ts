/**
 * Seed Ma 1a/1b/1c from ZIP packages (delprov PDFs inside archives).
 *
 * Usage:
 *   npx tsx scripts/seed-ma-zip.ts
 *   npx tsx scripts/seed-ma-zip.ts --dry-run
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';
import {
  extractQuestionBodies,
  questionsToSeeds,
  type FragaSeed,
} from './lib/ma-parse';

const dryRun = process.argv.includes('--dry-run');
const PROV_DIR = path.resolve('public/prov');
const MANIFEST = JSON.parse(fs.readFileSync('src/data/manifest.json', 'utf-8'));

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ZIP_TARGETS = (MANIFEST as { id: string; original_filename?: string; title?: string }[])
  .filter((m) => m.original_filename && /^Ma 1[a-c] VT (2017|2022)/i.test(m.original_filename))
  .map((m) => ({
    slug: m.id,
    zipFile: m.original_filename!,
    title: m.title || m.original_filename!,
  }));

function delprovFromFilename(pdfName: string): { beteckning: string; ordning: number; maxQ: number } | null {
  const m =
    pdfName.match(/Delprov\s+([A-D])/i) ||
    pdfName.match(/delprov\s+([A-D])/i) ||
    pdfName.match(/Delprov\s+([A-D])_/i);
  if (!m) return null;
  const letter = m[1].toUpperCase();
  const ordning = letter.charCodeAt(0) - 64;
  const maxQ = letter === 'B' ? 20 : letter === 'C' ? 25 : 30;
  return { beteckning: `Delprov ${letter}`, ordning, maxQ };
}

async function extractPdfText(filePath: string): Promise<string> {
  const buf = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

async function getOrCreateDelprov(provId: string, beteckning: string, ordning: number) {
  const { data: existing } = await supabase
    .from('delprov')
    .select('id')
    .eq('prov_id', provId)
    .eq('beteckning', beteckning)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from('delprov')
    .insert({ prov_id: provId, beteckning, titel: beteckning, ordning })
    .select('id')
    .single();
  if (error) throw error;
  return created.id;
}

async function upsertFraga(delprovId: string, seed: FragaSeed) {
  const { data: existing } = await supabase
    .from('fraga')
    .select('id')
    .eq('delprov_id', delprovId)
    .eq('fraga_nummer', seed.fraga_nummer)
    .maybeSingle();

  const row = {
    delprov_id: delprovId,
    fraga_nummer: seed.fraga_nummer,
    typ: seed.typ,
    text: seed.text,
    svarsalternativ_json: seed.svarsalternativ_json ?? null,
    korrekt_svar: seed.korrekt_svar ?? null,
    vanliga_missforstand: seed.vanliga_missforstand,
    varfor_viktig: seed.varfor_viktig,
    max_poang: seed.max_poang,
    kalla: seed.kalla,
    human_reviewed: true,
  };

  if (dryRun) return;

  if (existing?.id) {
    await supabase.from('fraga').update(row).eq('id', existing.id);
  } else {
    await supabase.from('fraga').insert(row);
  }
}

async function main() {
  console.log(dryRun ? '🧪 Dry-run Ma ZIP seed…' : '📦 Seeding Ma 1a/1b/1c from ZIP…');

  let total = 0;

  for (const { slug, zipFile, title } of ZIP_TARGETS) {
    const zipPath = path.join(PROV_DIR, zipFile);
    if (!fs.existsSync(zipPath)) {
      console.warn(`  ⚠ Missing ZIP: ${zipFile}`);
      continue;
    }

    const { data: prov } = await supabase.from('prov').select('id').eq('slug', slug).single();
    if (!prov) {
      console.warn(`  ⚠ No prov row: ${slug}`);
      continue;
    }

    const tmpDir = path.join('.tmp', 'ma-zip', slug);
    const patterns = JSON.stringify(['delprov']);
    let extracted: string[] = [];
    try {
      const out = execFileSync(
        'python3',
        ['scripts/extract-zip-pdfs.py', zipPath, tmpDir, patterns],
        { encoding: 'utf-8' }
      );
      extracted = JSON.parse(out.trim() || '[]');
    } catch (e) {
      console.warn(`  ⚠ Extract failed ${zipFile}:`, e);
      continue;
    }

    if (!extracted.length) {
      console.warn(`  ⚠ No delprov PDFs in ${zipFile}`);
      continue;
    }

    if (!dryRun) {
      await supabase
        .from('prov')
        .update({ zip_url: `/prov/${zipFile}` })
        .eq('id', prov.id);
    }

    console.log(`\n→ ${slug} (${title}) — ${extracted.length} delprov-PDF:er`);

    for (const pdfName of extracted.sort()) {
      const meta = delprovFromFilename(pdfName);
      if (!meta) {
        console.warn(`    skip ${pdfName}`);
        continue;
      }

      const text = await extractPdfText(path.join(tmpDir, pdfName));
      const questions = extractQuestionBodies(text, meta.maxQ, 1);

      const seeds = questionsToSeeds(questions, {
        level: title,
        delprov: meta.beteckning,
      });

      if (!seeds.length) {
        console.warn(`    ⚠ ${pdfName}: 0 frågor`);
        continue;
      }

      const delprovId = await getOrCreateDelprov(prov.id, meta.beteckning, meta.ordning);
      console.log(`    ${meta.beteckning}: ${seeds.length} frågor (${pdfName})`);

      for (const seed of seeds) {
        await upsertFraga(delprovId, seed);
        total++;
      }
    }
  }

  const { count } = await supabase.from('fraga').select('*', { count: 'exact', head: true });
  console.log(`\n✅ ZIP seed done. Touched ~${total} frågor. Total fraga in DB: ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});