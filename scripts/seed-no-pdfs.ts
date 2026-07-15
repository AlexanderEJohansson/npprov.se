/**
 * Seed per-fråga data from Umeå NO åk 9 delprov PDFs (npno9-*).
 *
 * Usage:
 *   npx tsx scripts/seed-no-pdfs.ts
 *   npx tsx scripts/seed-no-pdfs.ts --dry-run
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

const KM_BY_SUBJECT: Record<string, string> = {
  biologi: 'BI9.1.1',
  fysik: 'FY9.1.1',
  kemi: 'KE9.1.1',
};

const NO_DELPROV_FILES = fs
  .readdirSync(PROV_DIR)
  .filter((f) => /^npno9-vt\d{2}-(biologi|fysik|kemi)-delprov-a\d\.pdf$/i.test(f));

const NO_DELPROV_A2A3 = fs
  .readdirSync(PROV_DIR)
  .filter((f) => /^npno9-vt\d{2}-(biologi|fysik|kemi)-delprov-a[23]\.pdf$/i.test(f));

function slugForFilename(filename: string): string | null {
  const base = filename.replace(/\.pdf$/i, '');
  const item = MANIFEST.find(
    (m: { title?: string; original_filename?: string }) =>
      m.title === base || m.original_filename === filename
  );
  return item?.id ?? null;
}

function inferTyp(text: string): string {
  const t = text.toLowerCase();
  if (/kryssa|fler kryss|alternativet [a-d]|påståenden [a-d]/i.test(t)) return 'flerval';
  if (/förklara|motivera|resonera|utveckla|diskutera/i.test(t)) return 'lang_svar';
  if (/uppg[eé]|ange|namnge|skriv/i.test(t)) return 'kort_svar';
  return 'lang_svar';
}

function inferMissforstand(text: string, subject: string): string {
  if (/fotosyntes|förbränning|cellandning/i.test(text)) {
    return 'Elever blandar ihop vilka gaser som produceras/förbrukas i fotosyntes respektive cellandning.';
  }
  if (/plast|miljö|övergödning/i.test(text)) {
    return 'Elever beskriver symptomet (t.ex. mer växtlighet) utan att koppla till orsak (t.ex. näringsämnen/kväve/fosfor).';
  }
  if (/genetik|anlag|kromosom/i.test(text)) {
    return 'Elever förklarar med vardagsspråk utan att använda begrepp som recessiv, bärare eller X-kromosom korrekt.';
  }
  return `Vanligt att elever svarar utan att använda ${subject}-begrepp tydligt eller att redovisa hela resonemanget.`;
}

function parseNoQuestions(text: string, subject: string): FragaSeed[] {
  const clean = text
    .replace(/\s*-- \d+ of \d+ --\s*/g, '\n')
    .replace(/NATIONELLT PROV I [A-ZÅÄÖ]+ ÅRSKURS \d+[^\n]*/gi, '\n')
    .replace(/Delprov A\d/gi, '\n');

  const re = /(?:^|\n)(\d+[a-z]?)\.\s+([\s\S]*?)(?=\n\d+[a-z]?\.\s+|$)/g;
  const seeds: FragaSeed[] = [];

  for (const m of clean.matchAll(re)) {
    const num = m[1];
    let body = m[2].trim();
    if (body.length < 25) continue;
    if (/^Prov som återanvänds/i.test(body)) continue;
    if (/^Det nationella provet ger dig/i.test(body)) continue;

    body = body.slice(0, 1200);
    const typ = inferTyp(body);

    seeds.push({
      fraga_nummer: num,
      typ,
      text: body,
      vanliga_missforstand: inferMissforstand(body, subject),
      varfor_viktig: `Delprov-fråga i ${subject} åk 9 (vt19/vt18) – testar centrala NO-förmågor enligt Lgr22.`,
      max_poang: typ === 'flerval' ? 1 : typ === 'kort_svar' ? 2 : 3,
      kalla: 'Umeå universitet / Skolverket (npno9)',
    });

    if (seeds.length >= 12) break;
  }

  return seeds;
}

async function extractPdfText(filename: string): Promise<string> {
  const buf = fs.readFileSync(path.join(PROV_DIR, filename));
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

async function getOrCreateDelprov(provId: string, beteckning: string) {
  const { data: existing } = await supabase
    .from('delprov')
    .select('id')
    .eq('prov_id', provId)
    .eq('beteckning', beteckning)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from('delprov')
    .insert({ prov_id: provId, beteckning, titel: beteckning, ordning: 1 })
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
        styrka: 0.8,
        kommentar: `Automatisk koppling från ${slug} fråga ${fragaNummer}`,
        added_by: 'seed-no-pdfs',
      },
      { onConflict: 'fraga_id,kunskapsmal_id' }
    );
  }
}

async function fixAssetUrls() {
  const { data: provs } = await supabase.from('prov').select('id, slug, pdf_url, zip_url');
  let fixed = 0;
  for (const p of provs || []) {
    const patch: { pdf_url?: string; zip_url?: string } = {};
    if (p.pdf_url?.includes('/data/raw/') || p.pdf_url?.includes('/public/prov/')) {
      const name = p.pdf_url.split('/').pop()!;
      patch.pdf_url = `/prov/${name}`;
    }
    if (p.zip_url?.includes('/data/raw/') || p.zip_url?.includes('/public/prov/')) {
      const name = p.zip_url.split('/').pop()!;
      patch.zip_url = `/prov/${name}`;
    }
    if (Object.keys(patch).length && !dryRun) {
      await supabase.from('prov').update(patch).eq('id', p.id);
      fixed++;
    }
  }
  console.log(`Fixed ${fixed} prov asset URLs`);
}

async function cleanupDuplicateMuntlig() {
  const slug = '52626660db';
  const { data: prov } = await supabase.from('prov').select('id').eq('slug', slug).single();
  if (!prov) return;

  const { data: dps } = await supabase.from('delprov').select('id').eq('prov_id', prov.id);
  const dpIds = (dps || []).map((d) => d.id);

  const { data: old } = await supabase
    .from('fraga')
    .select('id')
    .in('delprov_id', dpIds)
    .eq('fraga_nummer', 'Muntlig framställning A');

  if (!old?.length) return;

  console.log(`Removing ${old.length} obsolete muntlig placeholder fraga`);
  if (!dryRun) {
    for (const f of old) {
      await supabase.from('fraga_kunskapsmal').delete().eq('fraga_id', f.id);
      await supabase.from('fraga').delete().eq('id', f.id);
    }
  }
}

async function main() {
  console.log(dryRun ? '🧪 Dry-run NO seed…' : '🧪 Seeding NO delprov from PDFs…');

  await fixAssetUrls();
  await cleanupDuplicateMuntlig();

  let totalFraga = 0;

  const allNoFiles = [...new Set([...NO_DELPROV_FILES, ...NO_DELPROV_A2A3])].sort();

  for (const filename of allNoFiles) {
    const slug = slugForFilename(filename);
    if (!slug) {
      console.warn(`No slug for ${filename}`);
      continue;
    }

    const subjectMatch = filename.match(/-(biologi|fysik|kemi)-/i);
    const subject = subjectMatch?.[1].toLowerCase() || 'no';
    const delprovMatch = filename.match(/delprov-(a\d)/i);
    const beteckning = delprovMatch ? `Delprov ${delprovMatch[1].toUpperCase()}` : 'Delprov';

    const { data: prov } = await supabase.from('prov').select('id, slug').eq('slug', slug).single();
    if (!prov) continue;

    const text = await extractPdfText(filename);
    const seeds = parseNoQuestions(text, subject);

    if (seeds.length === 0) {
      console.warn(`  ⚠ No questions parsed: ${filename}`);
      continue;
    }

    if (!dryRun) {
      await supabase.from('prov').update({ pdf_url: `/prov/${filename}` }).eq('id', prov.id);
    }

    const delprovId = await getOrCreateDelprov(prov.id, beteckning);

    console.log(`\n→ ${slug} (${filename}) — ${seeds.length} frågor`);
    for (const seed of seeds) {
      await upsertFraga(delprovId, seed);
      totalFraga += 1;
      console.log(`  ✓ ${seed.fraga_nummer} (${seed.typ})`);
    }

    const km = KM_BY_SUBJECT[subject];
    if (km) await seedJunction(slug, seeds[0].fraga_nummer, km);
  }

  const { count } = await supabase.from('fraga').select('*', { count: 'exact', head: true });
  console.log(`\n✅ NO seed done. Added/updated ~${totalFraga} frågor. Total fraga in DB: ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});