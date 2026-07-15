/**
 * Seed all Engelska PDF entries from manifest (ak6 materials + reading texts).
 *
 * Usage: npx tsx scripts/seed-eng-pdfs.ts
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';
import { parseEngelskaElevkort } from './lib/eng-parse';
import {
  parseEngelskaAk6Elevkort,
  parseEngelskaAk6GapFill,
  parseEngelskaAk6Writing,
} from './lib/eng-ak6-parse';
import { sanitizeDbText, sanitizePdfText } from './lib/sanitize-text';

const dryRun = process.argv.includes('--dry-run');
const PROV_DIR = path.resolve('public/prov');
const MANIFEST = JSON.parse(fs.readFileSync('src/data/manifest.json', 'utf-8'));

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ManifestRow = {
  id: string;
  subject: string;
  title?: string;
  original_filename?: string;
  level?: string;
};

const TARGETS = (MANIFEST as ManifestRow[]).filter(
  (m) => m.subject === 'Engelska' && m.original_filename?.toLowerCase().endsWith('.pdf')
);

async function extractPdfText(filePath: string): Promise<string> {
  const buf = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  await parser.destroy();
  return sanitizePdfText(result.text);
}

function pickParser(filename: string, title: string, text: string) {
  const lower = filename.toLowerCase();
  if (lower.includes('elevkort') || lower.includes('speaking')) {
    return parseEngelskaAk6Elevkort(text);
  }
  if (lower.includes('living_statues') || lower.includes('teen_biking')) {
    const t = title.replace(/_/g, ' ');
    return parseEngelskaAk6GapFill(text, t);
  }
  if (lower.includes('översikt') || lower.includes('oversikt')) {
    return parseEngelskaAk6Writing(text, title);
  }
  if (lower.startsWith('en_ak6_')) {
    return parseEngelskaAk6Writing(text, title.replace(/_/g, ' '));
  }
  if (text.includes('Gula elevkort') || text.includes('Blå elevkort')) {
    return parseEngelskaElevkort(text);
  }
  return parseEngelskaAk6Writing(text, title);
}

function delprovLabel(filename: string): string {
  if (/elevkort|speaking/i.test(filename)) return 'Muntliga elevkort';
  if (/översikt|oversikt/i.test(filename)) return 'Delprovöversikt';
  if (/living|teen/i.test(filename)) return 'Delprov läsning';
  return 'Skrivuppgift';
}

async function getOrCreateDelprov(provId: string, beteckning: string) {
  const { data: existing } = await supabase
    .from('delprov')
    .select('id')
    .eq('prov_id', provId)
    .eq('beteckning', beteckning)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data, error } = await supabase
    .from('delprov')
    .insert({ prov_id: provId, beteckning, titel: beteckning, ordning: 1 })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function upsertFraga(delprovId: string, seed: {
  fraga_nummer: string;
  typ: string;
  text: string;
  vanliga_missforstand?: string;
  varfor_viktig?: string;
  max_poang?: number;
  kalla?: string;
}) {
  const row = {
    delprov_id: delprovId,
    fraga_nummer: seed.fraga_nummer,
    typ: seed.typ,
    text: sanitizeDbText(seed.text) || seed.fraga_nummer,
    vanliga_missforstand: sanitizeDbText(seed.vanliga_missforstand),
    varfor_viktig: sanitizeDbText(seed.varfor_viktig),
    max_poang: seed.max_poang,
    kalla: sanitizeDbText(seed.kalla),
    human_reviewed: true,
  };
  if (dryRun) return;

  const { data: existing } = await supabase
    .from('fraga')
    .select('id')
    .eq('delprov_id', delprovId)
    .eq('fraga_nummer', seed.fraga_nummer)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase.from('fraga').update(row).eq('id', existing.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('fraga').insert(row);
  if (error) throw error;
}

async function main() {
  console.log(dryRun ? '🧪 Dry-run Engelska PDF seed…' : '📘 Seeding all Engelska PDFs…');
  let total = 0;

  for (const row of TARGETS) {
    const file = row.original_filename!;
    const pdfPath = path.join(PROV_DIR, file);
    if (!fs.existsSync(pdfPath)) {
      console.warn(`  ⚠ Missing ${file}`);
      continue;
    }

    const { data: prov } = await supabase.from('prov').select('id').eq('slug', row.id).single();
    if (!prov) {
      console.warn(`  ⚠ No prov ${row.id}`);
      continue;
    }

    if (!dryRun) {
      await supabase.from('prov').update({ pdf_url: `/prov/${file}` }).eq('id', prov.id);
    }

    const text = await extractPdfText(pdfPath);
    const seeds = pickParser(file, row.title || file, text);
    if (!seeds.length) {
      console.warn(`  ⚠ 0 frågor: ${file}`);
      continue;
    }

    const delprovId = await getOrCreateDelprov(prov.id, delprovLabel(file));
    console.log(`  ${row.id} ${file}: ${seeds.length} frågor`);

    for (const seed of seeds) {
      await upsertFraga(delprovId, seed);
      total++;
    }
  }

  const { count } = await supabase.from('fraga').select('*', { count: 'exact', head: true });
  console.log(`\n✅ Engelska PDF seed done. Touched ~${total}. Total fraga: ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});