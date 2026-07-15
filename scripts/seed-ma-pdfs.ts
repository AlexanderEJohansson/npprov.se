/**
 * Seed per-fråga data from gymnasium Ma PDFs and åk 3 Ma delprov PDFs.
 *
 * Usage:
 *   npx tsx scripts/seed-ma-pdfs.ts
 *   npx tsx scripts/seed-ma-pdfs.ts --dry-run
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';

const dryRun = process.argv.includes('--dry-run');
const PROV_DIR = path.resolve('public/prov');
const MANIFEST = JSON.parse(fs.readFileSync('src/data/manifest.json', 'utf-8'));

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface FragaSeed {
  fraga_nummer: string;
  typ: string;
  text: string;
  vanliga_missforstand?: string;
  varfor_viktig?: string;
  max_poang?: number;
  kalla?: string;
}

interface DelprovBatch {
  beteckning: string;
  ordning: number;
  seeds: FragaSeed[];
}

const GYM_MA_FILES = fs
  .readdirSync(PROV_DIR)
  .filter((f) => /^Ma\d[a-z]?-(vt|ht)\d{2}\.pdf$/i.test(f));

const AK3_MA_FILES = fs
  .readdirSync(PROV_DIR)
  .filter((f) => /^Np 3 2022 Ma Delprov [A-G]/i.test(f));

function slugForFilename(filename: string): string | null {
  const item = MANIFEST.find(
    (m: { id?: string; original_filename?: string }) => m.original_filename === filename
  );
  return item?.id ?? null;
}

function inferTyp(text: string): string {
  const t = text.toLowerCase();
  if (/sant\s+falskt|ringa in|kryss|sätt ett kryss/i.test(t)) return 'flerval';
  if (/derivera|bestäm|lös|beräkna|visa att|skissa/i.test(t)) return 'kort_svar';
  if (/förklara|motivera|resonera|redovisa/i.test(t)) return 'lang_svar';
  return 'kort_svar';
}

function parsePoints(body: string): number {
  const m = body.match(/\((\d+)\/\d+\/\d+\)/);
  if (m) return Math.max(1, parseInt(m[1], 10));
  return 2;
}

function truncateBeforeBedömning(text: string): string {
  const markers = [
    /Allmän information om bedöm/i,
    /Bedömningsanvisningar/i,
    /Instruktioner för sammanställning/i,
    /Kopieringsunderlag och webbmaterial/i,
  ];
  let cut = text.length;
  for (const re of markers) {
    const idx = text.search(re);
    if (idx > 200) cut = Math.min(cut, idx);
  }
  return text.slice(0, cut);
}

function cleanMaText(text: string): string {
  return truncateBeforeBedömning(text)
    .replace(/\s*-- \d+ of \d+ --\s*/g, '\n')
    .replace(/NpMa[^\n]*\n\d+\n/g, '\n')
    .replace(/Np3Ma\d+ Delprov [A-Z] \d+\n/g, '\n')
    .replace(/© Skolverket[^\n]*/gi, '\n')
    .replace(/Prov som återanvänds[\s\S]*?2025-06-30\./gi, '\n')
    .replace(/Elevens namn och klass\/grupp[\s\S]*?Delprov [A-Z]\n/gi, '\n');
}

function extractQuestionBodies(text: string, maxNum: number): { num: number; body: string }[] {
  const clean = cleanMaText(text);
  const re = /(?:^|\n)(\d+)\.\s+([\s\S]*?)(?=\n\d+\.\s+|$)/g;
  const seen = new Set<number>();
  const out: { num: number; body: string }[] = [];

  for (const m of clean.matchAll(re)) {
    const num = parseInt(m[1], 10);
    if (num < 1 || num > maxNum) continue;
    if (seen.has(num)) continue;

    let body = m[2]
      .trim()
      .replace(/\(\d+\/\d+\/\d+\)/g, '')
      .replace(/_{3,}/g, ' ___ ')
      .replace(/\s+/g, ' ')
      .trim();

    if (body.length < 25) continue;
    if (/^Namn:|Födelsedatum|Gymnasieprogram|Delprov [BC]:/i.test(body)) continue;
    if (/^Uppgift \d+|bedömning|betygssättning|Kommunikationspoäng/i.test(body)) continue;
    if (/^Max \d+\/\d+\/\d+/.test(body)) continue;

    seen.add(num);
    out.push({ num, body: body.slice(0, 1400) });
  }

  return out.sort((a, b) => a.num - b.num);
}

function toSeeds(
  questions: { num: number; body: string }[],
  context: { level: string; delprov: string; year?: number }
): FragaSeed[] {
  return questions.map(({ num, body }) => ({
    fraga_nummer: String(num),
    typ: inferTyp(body),
    text: body,
    vanliga_missforstand:
      'Elever hoppar över motivering eller redovisar bara slutsvar utan mellanled – vanligt i gymnasie-Ma.',
    varfor_viktig: `${context.level} – ${context.delprov} (nationellt prov i matematik).`,
    max_poang: parsePoints(body),
    kalla: 'Skolverket (nationellt prov matematik)',
  }));
}

function parseGymMaPdf(text: string): DelprovBatch[] {
  const bCut = /Uppgift 1[–-]10/i.test(text) ? 10 : 10;
  const questions = extractQuestionBodies(text, 19);
  const b = questions.filter((q) => q.num <= bCut);
  const c = questions.filter((q) => q.num > bCut && q.num <= 19);

  const batches: DelprovBatch[] = [];
  if (b.length) {
    batches.push({
      beteckning: 'Delprov B',
      ordning: 1,
      seeds: toSeeds(b, { level: 'Gymnasium Ma', delprov: 'Delprov B' }),
    });
  }
  if (c.length) {
    batches.push({
      beteckning: 'Delprov C',
      ordning: 2,
      seeds: toSeeds(c, { level: 'Gymnasium Ma', delprov: 'Delprov C' }),
    });
  }
  return batches;
}

function parseAk3MaPdf(text: string, filename: string): DelprovBatch[] {
  const letter = filename.match(/Delprov ([A-G])/i)?.[1]?.toUpperCase() || 'B';
  const questions = extractQuestionBodies(text, 15);
  if (!questions.length) return [];

  return [
    {
      beteckning: `Delprov ${letter}`,
      ordning: letter.charCodeAt(0) - 64,
      seeds: toSeeds(questions, { level: 'Matematik åk 3', delprov: `Delprov ${letter}` }),
    },
  ];
}

async function extractPdfText(filename: string): Promise<string> {
  const buf = fs.readFileSync(path.join(PROV_DIR, filename));
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
    vanliga_missforstand: seed.vanliga_missforstand,
    varfor_viktig: seed.varfor_viktig,
    max_poang: seed.max_poang,
    kalla: seed.kalla,
    human_reviewed: true,
  };

  if (dryRun) return existing?.id ?? 'dry-run';

  if (existing?.id) {
    await supabase.from('fraga').update(row).eq('id', existing.id);
    return existing.id;
  }

  const { data, error } = await supabase.from('fraga').insert(row).select('id').single();
  if (error) throw error;
  return data.id;
}

async function seedJunction(slug: string, fragaNummer: string, kod: string) {
  const { data: prov } = await supabase.from('prov').select('id').eq('slug', slug).single();
  if (!prov) return;

  const { data: dps } = await supabase.from('delprov').select('id').eq('prov_id', prov.id);
  const dpIds = (dps || []).map((d) => d.id);
  if (!dpIds.length) return;

  const { data: fragor } = await supabase
    .from('fraga')
    .select('id')
    .in('delprov_id', dpIds)
    .eq('fraga_nummer', fragaNummer)
    .limit(1);

  const { data: km } = await supabase.from('kunskapsmal').select('id').eq('kod', kod).single();
  if (!fragor?.[0]?.id || !km?.id) return;

  if (!dryRun) {
    await supabase.from('fraga_kunskapsmal').upsert(
      {
        fraga_id: fragor[0].id,
        kunskapsmal_id: km.id,
        styrka: 0.7,
        kommentar: `Automatisk koppling från ${slug} fråga ${fragaNummer}`,
        added_by: 'seed-ma-pdfs',
      },
      { onConflict: 'fraga_id,kunskapsmal_id' }
    );
  }
}

async function processFile(
  filename: string,
  parser: (text: string, filename: string) => DelprovBatch[]
) {
  const slug = slugForFilename(filename);
  if (!slug) {
    console.warn(`  ⚠ No slug: ${filename}`);
    return 0;
  }

  const { data: prov } = await supabase.from('prov').select('id, slug').eq('slug', slug).single();
  if (!prov) {
    console.warn(`  ⚠ No prov row: ${slug}`);
    return 0;
  }

  const text = await extractPdfText(filename);
  const batches = parser(text, filename);
  if (!batches.length) {
    console.warn(`  ⚠ No questions: ${filename}`);
    return 0;
  }

  if (!dryRun) {
    await supabase.from('prov').update({ pdf_url: `/prov/${filename}` }).eq('id', prov.id);
  }

  let count = 0;
  console.log(`\n→ ${slug} (${filename})`);
  for (const batch of batches) {
    const delprovId = await getOrCreateDelprov(prov.id, batch.beteckning, batch.ordning);
    console.log(`  ${batch.beteckning}: ${batch.seeds.length} frågor`);
    for (const seed of batch.seeds) {
      await upsertFraga(delprovId, seed);
      count += 1;
    }
  }

  const km = filename.startsWith('Np 3') ? 'MA9.1.1' : 'MA9.2.1';
  const firstNum = batches[0]?.seeds[0]?.fraga_nummer;
  if (firstNum) await seedJunction(slug, firstNum, km);

  return count;
}

async function main() {
  console.log(dryRun ? '🧪 Dry-run Ma seed…' : '📐 Seeding Ma PDFs…');

  let total = 0;

  for (const filename of GYM_MA_FILES.sort()) {
    total += await processFile(filename, (text) => parseGymMaPdf(text));
  }

  for (const filename of AK3_MA_FILES.sort()) {
    total += await processFile(filename, (text, fn) => parseAk3MaPdf(text, fn));
  }

  const { count } = await supabase.from('fraga').select('*', { count: 'exact', head: true });
  console.log(`\n✅ Ma seed done. Touched ~${total} frågor. Total fraga in DB: ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});