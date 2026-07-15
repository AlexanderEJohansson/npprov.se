/**
 * Seed prov from Skolverket TEX ZIP (CNT titles + I*.TEX body text).
 * Targets manifest ZIP entries without delprov rows (ak6 2017/18, gymnasium, etc.).
 *
 * Usage:
 *   npx tsx scripts/seed-zip-tex.ts
 *   npx tsx scripts/seed-zip-tex.ts --dry-run
 *   npx tsx scripts/seed-zip-tex.ts --slug=bcfd84ecc7
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { sanitizeDbText } from './lib/sanitize-text';

const dryRun = process.argv.includes('--dry-run');
const slugFilter = process.argv.find((a) => a.startsWith('--slug='))?.split('=')[1];
const PROV_DIR = path.resolve('public/prov');
const MANIFEST = JSON.parse(fs.readFileSync('src/data/manifest.json', 'utf-8')) as {
  id: string;
  subject: string;
  title?: string;
  original_filename?: string;
}[];

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const KM_BY_SUBJECT: Record<string, string> = {
  Engelska: 'EN9.1.1',
  Historia: 'HI9.1.1',
  Samhällskunskap: 'SA9.1.1',
  Religionskunskap: 'RE9.1.1',
  Matematik: 'MA9.1.1',
  Svenska: 'SV9.1.1',
  Biologi: 'BI9.1.1',
  Fysik: 'FY9.1.1',
  Kemi: 'KE9.1.1',
};

interface TexQuestion {
  code: string;
  title: string;
  body?: string;
}

interface TexPackage {
  code: string;
  beteckning: string;
  questions: TexQuestion[];
}

function extractTexPackages(zipPath: string): TexPackage[] {
  const out = execFileSync('python3', ['scripts/extract-tex-body.py', zipPath], {
    encoding: 'utf-8',
  });
  return JSON.parse(out.trim() || '[]');
}

function isSkippableTitle(title: string): boolean {
  const t = title.toLowerCase();
  return (
    t.includes('information till') ||
    t.includes('bedömningsmatris') ||
    t.includes('bed mningsmatris') ||
    t.includes('översikt:') ||
    t.includes('versikt:') ||
    t.includes('självbedömning') ||
    t.includes('sj lvbed') ||
    t.length < 6
  );
}

function fragaSeed(subject: string, pkg: TexPackage, q: TexQuestion) {
  const body = q.body?.trim();
  const text = body
    ? `${subject} ${pkg.beteckning}, ${q.code} ${q.title}: ${body.slice(0, 1500)}`
    : `${subject} ${pkg.beteckning}, ${q.code}: ${q.title}. Fullständig uppgiftstext med bilder finns i Skolverkets TEX-paket ${pkg.code} (ZIP).`;

  return {
    fraga_nummer: q.code,
    typ: /speaking|muntlig|discuss|elevblad/i.test(q.title + (body || '')) ? 'muntlig' : 'lang_svar',
    text,
    vanliga_missforstand: `Elever svarar på ${q.title} utan att följa instruktionerna eller motivera svaret.`,
    varfor_viktig: `${subject} – ${q.title} (${pkg.beteckning}, paket ${pkg.code}).`,
    max_poang: 3,
    kalla: `Skolverket (TEX ${pkg.code}, ${q.code})`,
  };
}

async function provHasDelprov(provId: string): Promise<boolean> {
  const { count } = await supabase
    .from('delprov')
    .select('*', { count: 'exact', head: true })
    .eq('prov_id', provId);
  return (count || 0) > 0;
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

async function upsertFraga(
  delprovId: string,
  seed: ReturnType<typeof fragaSeed>
): Promise<string | undefined> {
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

  const { data: existing } = await supabase
    .from('fraga')
    .select('id')
    .eq('delprov_id', delprovId)
    .eq('fraga_nummer', seed.fraga_nummer)
    .maybeSingle();

  if (dryRun) return existing?.id;

  if (existing?.id) {
    const { error } = await supabase.from('fraga').update(row).eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await supabase.from('fraga').insert(row).select('id').single();
  if (error) throw error;
  return data?.id;
}

async function seedJunction(fragaId: string, kod: string) {
  const { data: km } = await supabase.from('kunskapsmal').select('id').eq('kod', kod).single();
  if (!km?.id || dryRun) return;
  await supabase.from('fraga_kunskapsmal').upsert(
    {
      fraga_id: fragaId,
      kunskapsmal_id: km.id,
      styrka: 0.7,
      kommentar: 'Automatisk koppling från seed-zip-tex',
      added_by: 'seed-zip-tex',
    },
    { onConflict: 'fraga_id,kunskapsmal_id' }
  );
}

async function main() {
  console.log(dryRun ? '🧪 Dry-run TEX ZIP seed…' : '📦 Seeding TEX ZIP prov…');
  let total = 0;

  const targets = MANIFEST.filter(
    (m) => m.original_filename?.toLowerCase().endsWith('.zip') && (!slugFilter || m.id === slugFilter)
  );

  for (const row of targets) {
    const zipFile = row.original_filename!;
    const zipPath = path.join(PROV_DIR, zipFile);
    if (!fs.existsSync(zipPath)) continue;

    const { data: prov } = await supabase.from('prov').select('id, amne').eq('slug', row.id).single();
    if (!prov) continue;

    if (!slugFilter && (await provHasDelprov(prov.id))) continue;

    let packages: TexPackage[];
    try {
      packages = extractTexPackages(zipPath);
    } catch {
      console.warn(`  ⚠ TEX extract failed: ${zipFile}`);
      continue;
    }
    if (!packages.length) continue;

    if (!dryRun) {
      await supabase.from('prov').update({ zip_url: `/prov/${zipFile}` }).eq('id', prov.id);
    }

    console.log(`\n→ ${row.id} (${zipFile})`);
    const subject = row.subject.replace(/\/SvA$/i, '').split('/')[0];
    const km = KM_BY_SUBJECT[subject] || KM_BY_SUBJECT[prov.amne];

    let ordning = 1;
    for (const pkg of packages) {
      const questions = pkg.questions.filter((q) => !isSkippableTitle(q.title));
      if (!questions.length) continue;

      const delprovId = await getOrCreateDelprov(prov.id, `${pkg.beteckning} (${pkg.code})`, ordning++);
      console.log(`    ${pkg.beteckning} ${pkg.code}: ${questions.length} uppgifter`);

      for (const q of questions) {
        const seed = fragaSeed(subject, pkg, q);
        const fragaId = await upsertFraga(delprovId, seed);
        total++;
        if (fragaId && km) await seedJunction(fragaId, km);
      }
    }
  }

  const { count } = await supabase.from('fraga').select('*', { count: 'exact', head: true });
  console.log(`\n✅ TEX ZIP seed done. Touched ~${total} frågor. Total fraga in DB: ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});