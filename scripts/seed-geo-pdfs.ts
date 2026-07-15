/**
 * Seed Geografi åk 9 from UU/Skolverket Delprov A+B PDFs (2013–2018).
 *
 * Usage:
 *   npx tsx scripts/seed-geo-pdfs.ts
 *   npx tsx scripts/seed-geo-pdfs.ts --dry-run
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';
import { geoKunskapsmalForText, resolveGeoParser, expandLetteredSubQuestions } from './lib/geo-parse';
import { sanitizeDbText, sanitizePdfText } from './lib/sanitize-text';

const dryRun = process.argv.includes('--dry-run');
const PROV_DIR = path.resolve('public/prov');
const GEO_SLUG = 'a8f3c2e91b';

function discoverGeoPdfs(): { file: string; year: number; delprov: string; ordning: number; parse: ReturnType<typeof resolveGeoParser> }[] {
  const out: { file: string; year: number; delprov: string; ordning: number; parse: ReturnType<typeof resolveGeoParser> }[] = [];
  for (const file of fs.readdirSync(PROV_DIR)) {
    const m = file.match(/^geo-ak9-(\d{4})-delprov-([ab])\.pdf$/i);
    if (!m) continue;
    const year = Number(m[1]);
    const letter = m[2].toUpperCase();
    out.push({
      file,
      year,
      delprov: `Delprov ${letter} (${year})`,
      ordning: letter === 'A' ? year * 2 : year * 2 + 1,
      parse: resolveGeoParser(file),
    });
  }
  return out.sort((a, b) => a.ordning - b.ordning);
}

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

function pdfUrlForDelprov(beteckning: string): string | null {
  const m = beteckning.match(/Delprov ([AB]) \((\d{4})\)/i);
  if (!m) return null;
  return `/prov/geo-ak9-${m[2]}-delprov-${m[1].toLowerCase()}.pdf`;
}

async function getOrCreateDelprov(provId: string, beteckning: string, ordning: number) {
  const pdf_url = pdfUrlForDelprov(beteckning);
  const { data: existing } = await supabase
    .from('delprov')
    .select('id')
    .eq('prov_id', provId)
    .eq('beteckning', beteckning)
    .maybeSingle();
  if (existing?.id) {
    if (!dryRun && pdf_url) {
      await supabase.from('delprov').update({ pdf_url }).eq('id', existing.id);
    }
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from('delprov')
    .insert({ prov_id: provId, beteckning, titel: beteckning, ordning, pdf_url })
    .select('id')
    .single();
  if (error) throw error;
  return created.id;
}

async function upsertFraga(
  delprovId: string,
  seed: {
    fraga_nummer: string;
    typ: string;
    text: string;
    vanliga_missforstand?: string;
    varfor_viktig?: string;
    max_poang?: number;
    kalla?: string;
  }
): Promise<string | undefined> {
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
    text: sanitizeDbText(seed.text) || seed.fraga_nummer,
    vanliga_missforstand: sanitizeDbText(seed.vanliga_missforstand),
    varfor_viktig: sanitizeDbText(seed.varfor_viktig),
    max_poang: seed.max_poang,
    kalla: sanitizeDbText(seed.kalla),
    human_reviewed: false,
  };

  if (dryRun) return existing?.id;

  if (existing?.id) {
    const { error } = await supabase.from('fraga').update(row).eq('id', existing.id);
    if (error) throw new Error(`update ${seed.fraga_nummer}: ${error.message}`);
    return existing.id;
  }
  const { data, error } = await supabase.from('fraga').insert(row).select('id').single();
  if (error) throw new Error(`insert ${seed.fraga_nummer}: ${error.message}`);
  return data?.id;
}

async function seedJunction(fragaId: string, kod: string) {
  const { data: km } = await supabase.from('kunskapsmal').select('id').eq('kod', kod).single();
  if (!km?.id || dryRun) return;

  await supabase.from('fraga_kunskapsmal').upsert(
    {
      fraga_id: fragaId,
      kunskapsmal_id: km.id,
      styrka: 0.8,
      kommentar: 'Automatisk koppling från seed-geo-pdfs',
      added_by: 'seed-geo-pdfs',
    },
    { onConflict: 'fraga_id,kunskapsmal_id' }
  );
}

async function main() {
  console.log(dryRun ? '🧪 Dry-run Geografi PDF seed…' : '🌍 Seeding Geografi åk 9 from PDFs…');

  const { data: prov } = await supabase.from('prov').select('id').eq('slug', GEO_SLUG).single();
  if (!prov) throw new Error(`Prov not found: ${GEO_SLUG}`);

  if (!dryRun) {
    await supabase
      .from('prov')
      .update({
        pdf_url: '/prov/geo-ak9-2018-delprov-a.pdf',
        ar: 2018,
        titel: 'Geografi åk 9 (2013–2018)',
        kalla: 'Uppsala universitet',
        kalla_url: 'https://www.uu.se/nationella-prov/geografi/aldre-prov-och-bedomningsstod',
        zip_url: null,
        metadata: { ar_span: '2013–2018', antal_lasar: 6, vard: 'arkiv' },
      })
      .eq('id', prov.id);
  }

  let total = 0;

  const pdfs = discoverGeoPdfs();
  if (!pdfs.length) console.warn('  ⚠ No geo-ak9-*-delprov-*.pdf in public/prov');

  for (const { file, year, delprov, ordning, parse } of pdfs) {
    const pdfPath = path.join(PROV_DIR, file);
    if (!fs.existsSync(pdfPath)) {
      console.warn(`  ⚠ Missing ${file}`);
      continue;
    }

    const text = await extractPdfText(pdfPath);
    const letter = /delprov-b/i.test(file) ? 'B' : 'A';
    let seeds = parse(text);
    seeds = seeds.flatMap((s) => expandLetteredSubQuestions(s, year, letter));
    if (!seeds.length) {
      console.warn(`  ⚠ 0 frågor in ${file}`);
      continue;
    }

    const delprovId = await getOrCreateDelprov(prov.id, delprov, ordning);
    console.log(`  ${delprov}: ${seeds.length} frågor från ${file}`);

    for (const seed of seeds) {
      const fragaId = await upsertFraga(delprovId, seed);
      if (fragaId) await seedJunction(fragaId, geoKunskapsmalForText(seed.text));
      total++;
    }
  }

  const { count } = await supabase.from('fraga').select('*', { count: 'exact', head: true });
  console.log(`\n✅ Geografi seed done. Touched ~${total} frågor. Total fraga in DB: ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});