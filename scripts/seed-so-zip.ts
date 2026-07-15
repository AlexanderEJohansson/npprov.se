/**
 * Seed Engelska + SO (Historia, Samhäll, Religion) from Skolverket ZIP/PDF packages.
 *
 * Note: SO-ämnen parsas via TEX CNT-innehållsförteckning (uppgiftstitlar + paketkod).
 * Engelska parsas från PDF (elevkort). Full TEX-body kräver svällbild-viewer.
 *
 * Usage:
 *   npx tsx scripts/seed-so-zip.ts
 *   npx tsx scripts/seed-so-zip.ts --dry-run
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';
import { parseEngelskaElevkort } from './lib/eng-parse';

import { sanitizeDbText, sanitizePdfText } from './lib/sanitize-text';

const dryRun = process.argv.includes('--dry-run');
const PROV_DIR = path.resolve('public/prov');
const MANIFEST = JSON.parse(fs.readFileSync('src/data/manifest.json', 'utf-8'));

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const KM_BY_SUBJECT: Record<string, string> = {
  Engelska: 'EN9.2.1',
  Historia: 'HI9.1.1',
  Samhällskunskap: 'SA9.1.1',
  Religionskunskap: 'RE9.1.1',
};

const ZIP_TARGETS = (MANIFEST as { id: string; subject: string; original_filename?: string; title?: string }[])
  .filter((m) =>
    m.original_filename &&
    /^(Engelska|Historia|Samhällskunskap|Religion)_ak9_2016-2017\.zip$/i.test(m.original_filename)
  )
  .map((m) => ({
    slug: m.id,
    zipFile: m.original_filename!,
    subject: m.subject,
    title: m.title || m.original_filename!,
  }));

function findNestedPdf(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findNestedPdf(full);
      if (found) return found;
    } else if (entry.name.toLowerCase().endsWith('.pdf')) {
      return full;
    }
  }
  return null;
}

async function extractPdfText(filePath: string): Promise<string> {
  const buf = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  await parser.destroy();
  return sanitizePdfText(result.text);
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

async function upsertFraga(delprovId: string, seed: {
  fraga_nummer: string;
  typ: string;
  text: string;
  vanliga_missforstand?: string;
  varfor_viktig?: string;
  max_poang?: number;
  kalla?: string;
}) {
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
    human_reviewed: true,
  };

  if (dryRun) return existing?.id;

  if (existing?.id) {
    const { error } = await supabase.from('fraga').update(row).eq('id', existing.id);
    if (error) throw new Error(`update fraga ${seed.fraga_nummer}: ${error.message}`);
    return existing.id;
  }
  const { data, error } = await supabase.from('fraga').insert(row).select('id').single();
  if (error) throw new Error(`insert fraga ${seed.fraga_nummer}: ${error.message}`);
  return data?.id;
}

async function seedJunction(slug: string, fragaNummer: string, kod: string) {
  const { data: prov } = await supabase.from('prov').select('id').eq('slug', slug).single();
  if (!prov) return;

  const { data: dps } = await supabase.from('delprov').select('id').eq('prov_id', prov.id);
  const dpIds = (dps || []).map((d) => d.id);
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
        styrka: 0.75,
        kommentar: `Automatisk koppling från seed-so-zip (${slug})`,
        added_by: 'seed-so-zip',
      },
      { onConflict: 'fraga_id,kunskapsmal_id' }
    );
  }
}

interface CntPackage {
  code: string;
  beteckning: string;
  questions: { code: string; title: string }[];
}

function extractCntPackages(zipPath: string): CntPackage[] {
  const out = execFileSync('python3', ['scripts/extract-tex-cnt.py', zipPath], {
    encoding: 'utf-8',
  });
  return JSON.parse(out.trim() || '[]');
}

interface TexBodyPackage {
  code: string;
  beteckning: string;
  questions: { code: string; title: string; body?: string }[];
}

function extractTexBodyPackages(zipPath: string): TexBodyPackage[] {
  try {
    const out = execFileSync('python3', ['scripts/extract-tex-body.py', zipPath], {
      encoding: 'utf-8',
    });
    return JSON.parse(out.trim() || '[]');
  } catch {
    return [];
  }
}

async function cleanupLegacyTexMetadata(provId: string) {
  if (dryRun) return;
  const { data: dps } = await supabase.from('delprov').select('id, beteckning').eq('prov_id', provId);
  for (const dp of dps || []) {
    if (/^Delprov \d{5}$/.test(dp.beteckning)) {
      await supabase.from('fraga').delete().eq('delprov_id', dp.id);
      await supabase.from('delprov').delete().eq('id', dp.id);
    }
    if (dp.beteckning === 'Delprov A') {
      await supabase.from('fraga').delete().eq('delprov_id', dp.id).eq('fraga_nummer', 'info');
    }
  }
}

function cntFragaSeed(
  subject: string,
  pkg: CntPackage,
  q: { code: string; title: string },
  body?: string
) {
  const text = body?.trim()
    ? `${subject} åk 9 ${pkg.beteckning}, ${q.code} ${q.title}: ${body.slice(0, 1500)}`
    : `${subject} åk 9 ${pkg.beteckning}, ${q.code}: ${q.title}. Fullständig uppgiftstext med bilder och källmaterial finns i Skolverkets TEX-paket ${pkg.code} (ZIP).`;

  return {
    fraga_nummer: q.code,
    typ: 'lang_svar' as const,
    text,
    vanliga_missforstand: `Elever svarar på ${q.title} utan källkritik, begrepp eller helhetsresonemang som krävs i ${subject} åk 9.`,
    varfor_viktig: `${subject} åk 9 – ${q.title}. Strukturerad uppgift från nationella prov 2016/17.`,
    max_poang: 3,
    kalla: body ? `Skolverket (TEX ${pkg.code}, ${q.code})` : `Skolverket (TEX CNT ${pkg.code}, ${q.code})`,
  };
}

async function main() {
  console.log(dryRun ? '🧪 Dry-run SO/Engelska ZIP seed…' : '📦 Seeding Engelska + SO from ZIP…');
  let total = 0;

  for (const { slug, zipFile, subject, title } of ZIP_TARGETS) {
    const zipPath = path.join(PROV_DIR, zipFile);
    if (!fs.existsSync(zipPath)) {
      console.warn(`  ⚠ Missing: ${zipFile}`);
      continue;
    }

    const { data: prov } = await supabase.from('prov').select('id').eq('slug', slug).single();
    if (!prov) {
      console.warn(`  ⚠ No prov: ${slug}`);
      continue;
    }

    if (!dryRun) {
      await supabase.from('prov').update({ zip_url: `/prov/${zipFile}` }).eq('id', prov.id);
    }

    const tmpDir = path.join('.tmp', 'so-zip', slug);
    fs.mkdirSync(tmpDir, { recursive: true });

    console.log(`\n→ ${slug} (${title})`);

    if (subject === 'Engelska') {
      execFileSync('python3', [
        'scripts/extract-zip-pdfs.py',
        zipPath,
        tmpDir,
        '[]',
      ]);
      const pdfPath = findNestedPdf(tmpDir);
      if (!pdfPath) {
        console.warn(`    ⚠ No PDF in ${zipFile}`);
        continue;
      }

      const text = await extractPdfText(pdfPath);
      const seeds = parseEngelskaElevkort(text);

      if (!seeds.length) {
        console.warn(`    ⚠ 0 frågor parsed`);
        continue;
      }

      const delprovId = await getOrCreateDelprov(prov.id, 'Muntliga elevkort', 1);
      console.log(`    ${seeds.length} frågor från ${path.basename(pdfPath)}`);

      for (const seed of seeds) {
        await upsertFraga(delprovId, seed);
        total++;
      }

      const km = KM_BY_SUBJECT[subject];
      if (km && seeds[0]) await seedJunction(slug, seeds[0].fraga_nummer, km);
      continue;
    }

    // Historia / Samhällskunskap / Religionskunskap — TEX CNT innehållsförteckning
    await cleanupLegacyTexMetadata(prov.id);
    const packages = extractCntPackages(zipPath);
    if (!packages.length) {
      console.warn(`    ⚠ No CNT delprov packages`);
      continue;
    }

    const texBodies = extractTexBodyPackages(zipPath);
    const bodyByCode = new Map<string, string>();
    for (const tp of texBodies) {
      for (const q of tp.questions) {
        if (q.body) bodyByCode.set(`${tp.code}:${q.code}`, q.body);
      }
    }

    let ordning = 1;
    for (const pkg of packages) {
      const delprovId = await getOrCreateDelprov(prov.id, pkg.beteckning, ordning++);
      const withBody = pkg.questions.filter((q) => bodyByCode.has(`${pkg.code}:${q.code}`)).length;
      console.log(`    ${pkg.beteckning} (${pkg.code}): ${pkg.questions.length} uppgifter (${withBody} med TEX-body)`);

      for (const q of pkg.questions) {
        const seed = cntFragaSeed(subject, pkg, q, bodyByCode.get(`${pkg.code}:${q.code}`));
        const fragaId = await upsertFraga(delprovId, seed);
        total++;
        const km = KM_BY_SUBJECT[subject];
        if (km && fragaId && !dryRun) {
          const { data: kmRow } = await supabase.from('kunskapsmal').select('id').eq('kod', km).single();
          if (kmRow?.id) {
            await supabase.from('fraga_kunskapsmal').upsert(
              {
                fraga_id: fragaId,
                kunskapsmal_id: kmRow.id,
                styrka: 0.7,
                kommentar: `CNT ${pkg.code}/${q.code}`,
                added_by: 'seed-so-zip',
              },
              { onConflict: 'fraga_id,kunskapsmal_id' }
            );
          }
        }
      }
    }
  }

  const { count } = await supabase.from('fraga').select('*', { count: 'exact', head: true });
  console.log(`\n✅ SO/Engelska seed done. Touched ~${total} frågor. Total fraga in DB: ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});