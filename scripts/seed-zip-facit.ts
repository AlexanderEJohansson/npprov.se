/**
 * Seed facit/bedömningskriterier for Skolverket TEX ZIP prov (Ma/Sv/En/Bio åk 9).
 *
 * Sources:
 *   - Ma åk 9: SU bedömningsanvisningar PDF (äp9 2016 = läsår 2016/2017)
 *   - Biologi åk 9: UMU vt17 bedömningsanvisningar
 *   - Sv/En: UU bedömningsunderlag PDF (kriterier, ej rätta svar)
 *
 * Usage:
 *   npx tsx scripts/seed-zip-facit.ts
 *   npx tsx scripts/seed-zip-facit.ts --dry-run
 *   npx tsx scripts/seed-zip-facit.ts --slug=28fd6666a6
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
  parseFacitMap,
  matchFlervalAnswer,
} from './lib/ma-parse';
import { parseGeoFacitEntries, facitMapFromEntries } from './lib/geo-facit-parse';
import {
  parseBedömningskriterierBlock,
  parseTexCodeFacit,
  parseSvBedömningsunderlag,
  parseNoBioFacit,
  mergeFacitMaps,
} from './lib/zip-facit-parse';

const dryRun = process.argv.includes('--dry-run');
const slugFilter = process.argv.find((a) => a.startsWith('--slug='))?.split('=')[1];
const PROV_DIR = path.resolve('public/prov');

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ZipTarget = {
  slug: string;
  zipFile: string;
  bedPdfs?: string[];
  texCodes?: string[];
  splitMaB1?: boolean;
  delprovPdf?: string;
};

const TARGETS: ZipTarget[] = [
  {
    slug: '28fd6666a6',
    zipFile: 'Matematik_ak9_2016-2017.zip',
    bedPdfs: ['ma-ak9-2016-bedomningsanvisningar-1.pdf', 'ma-ak9-2016-bedomningsanvisningar-2.pdf'],
    texCodes: ['90598', '90599', '90600'],
    splitMaB1: true,
    delprovPdf: 'ma-ak9-2016-delprov-b.pdf',
  },
  {
    slug: '3fe9289485',
    zipFile: 'Biologi_ak9_2016-2017.zip',
    bedPdfs: ['npno9-vt17-biologi-bedomningsanvisning.pdf'],
    texCodes: ['90565', '90566', '90585', '90586', '90587'],
  },
  {
    slug: '3ae0f64fa3',
    zipFile: 'Svsva_ak9_2016-2017.zip',
    bedPdfs: ['sv-ak9-bedomningsunderlag-b-inget-trams.pdf'],
    texCodes: ['90549', '90550', '90551'],
  },
  {
    slug: 'c2867e6e93',
    zipFile: 'Engelska_ak9_2016-2017.zip',
    bedPdfs: ['en-ak9-delprov-a-exempel.pdf'],
    texCodes: ['90589', '90590', '90591', '90592', '90593'],
  },
];

async function extractPdfText(filePath: string): Promise<string> {
  const buf = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

function extractDocxFromZip(zipPath: string, code: string): string {
  try {
    const out = execFileSync('python3', ['scripts/extract-zip-docx.py', zipPath, code], {
      encoding: 'utf-8',
    });
    const parsed = JSON.parse(out.trim() || '{}') as { text?: string };
    return parsed.text || '';
  } catch {
    return '';
  }
}

async function seedMaFromSuDelprov(provId: string, pdfName: string): Promise<number> {
  const pdfPath = path.join(PROV_DIR, pdfName);
  if (!fs.existsSync(pdfPath)) return 0;

  const text = await extractPdfText(pdfPath);
  const questions = extractQuestionBodies(text, 22, 1);
  if (questions.length < 5) return 0;

  const seeds = questionsToSeeds(questions, { level: 'Matematik åk 9', delprov: 'Delprov B' });
  const beteckning = 'Delprov B';

  if (dryRun) {
    console.log(`  🧪 Would seed ${seeds.length} frågor from ${pdfName}`);
    return seeds.length;
  }

  let delprovId: string;
  const { data: existingDp } = await supabase
    .from('delprov')
    .select('id')
    .eq('prov_id', provId)
    .eq('beteckning', beteckning)
    .maybeSingle();

  if (existingDp?.id) {
    delprovId = existingDp.id;
    const { data: old } = await supabase.from('fraga').select('id').eq('delprov_id', delprovId);
    const ids = (old || []).map((f) => f.id);
    if (ids.length) {
      await supabase.from('fraga_kunskapsmal').delete().in('fraga_id', ids);
      await supabase.from('fraga').delete().eq('delprov_id', delprovId);
    }
  } else {
    const { data: created } = await supabase
      .from('delprov')
      .insert({ prov_id: provId, beteckning, titel: beteckning, ordning: 2 })
      .select('id')
      .single();
    delprovId = created!.id;
  }

  for (const seed of seeds) {
    await supabase.from('fraga').insert({
      delprov_id: delprovId,
      fraga_nummer: seed.fraga_nummer,
      typ: seed.typ,
      text: seed.text,
      svarsalternativ_json: seed.svarsalternativ_json ?? null,
      vanliga_missforstand: seed.vanliga_missforstand,
      varfor_viktig: seed.varfor_viktig,
      max_poang: seed.max_poang,
      kalla: 'Stockholms universitet (äp9 2016 Delprov B)',
      human_reviewed: false,
    });
  }
  console.log(`  ↔ ${pdfName} → ${seeds.length} frågor (Delprov B)`);
  return seeds.length;
}

async function splitMaDelprovB(provId: string): Promise<number> {
  const { data: dp } = await supabase
    .from('delprov')
    .select('id')
    .eq('prov_id', provId)
    .ilike('beteckning', '%Delprov B%')
    .maybeSingle();
  if (!dp?.id) return 0;

  const { data: b1 } = await supabase
    .from('fraga')
    .select('id, text')
    .eq('delprov_id', dp.id)
    .eq('fraga_nummer', 'B1')
    .maybeSingle();
  if (!b1?.text || b1.text.length < 200) return 0;

  const body = b1.text.replace(/^Matematik Delprov B, B1[^:]*:\s*/i, '');
  const questions = extractQuestionBodies(body, 22, 1);
  if (questions.length < 5) return 0;

  const seeds = questionsToSeeds(questions, { level: 'Matematik åk 9', delprov: 'Delprov B' });
  if (dryRun) {
    console.log(`  🧪 Would split B1 → ${seeds.length} frågor`);
    return seeds.length;
  }

  const { data: existing } = await supabase.from('fraga').select('id').eq('delprov_id', dp.id);
  const ids = (existing || []).map((f) => f.id);
  if (ids.length) {
    await supabase.from('fraga_kunskapsmal').delete().in('fraga_id', ids);
    await supabase.from('fraga').delete().eq('delprov_id', dp.id);
  }

  for (const seed of seeds) {
    await supabase.from('fraga').insert({
      delprov_id: dp.id,
      fraga_nummer: seed.fraga_nummer,
      typ: seed.typ,
      text: seed.text,
      svarsalternativ_json: seed.svarsalternativ_json ?? null,
      vanliga_missforstand: seed.vanliga_missforstand,
      varfor_viktig: seed.varfor_viktig,
      max_poang: seed.max_poang,
      kalla: seed.kalla,
      human_reviewed: false,
    });
  }
  console.log(`  ↔ split B1 → ${seeds.length} numrerade frågor`);
  return seeds.length;
}

async function applyFacit(provId: string, facitMap: Record<string, string>, subject: string): Promise<number> {
  const { data: dps } = await supabase.from('delprov').select('id').eq('prov_id', provId);
  const dpIds = (dps || []).map((d) => d.id);
  if (!dpIds.length) return 0;

  const { data: fragor } = await supabase
    .from('fraga')
    .select('id, fraga_nummer, typ, svarsalternativ_json, korrekt_svar')
    .in('delprov_id', dpIds);

  let updated = 0;
  for (const f of fragor || []) {
    const num = String(f.fraga_nummer).trim();
    const localNum = num.match(/^[A-D](\d{1,2})$/i)?.[1];
    const facit =
      facitMap[num] ||
      facitMap[num.toUpperCase()] ||
      (localNum ? facitMap[localNum] : null) ||
      null;
    if (!facit || f.korrekt_svar === facit) continue;

    const korrekt =
      f.typ === 'flerval' && f.svarsalternativ_json
        ? matchFlervalAnswer(facit, f.svarsalternativ_json as { id: string; text: string }[]) || facit
        : facit;

    if (!dryRun) await supabase.from('fraga').update({ korrekt_svar: korrekt.slice(0, 4000) }).eq('id', f.id);
    updated++;
  }
  return updated;
}

async function seedTarget(target: ZipTarget): Promise<number> {
  const zipPath = path.join(PROV_DIR, target.zipFile);
  if (!fs.existsSync(zipPath)) {
    console.warn(`  ⚠ Missing ZIP ${target.zipFile}`);
    return 0;
  }

  const { data: prov } = await supabase.from('prov').select('id, amne').eq('slug', target.slug).single();
  if (!prov?.id) {
    console.warn(`  ⚠ Prov not found: ${target.slug}`);
    return 0;
  }

  console.log(`\n→ ${target.slug} (${prov.amne})`);

  if (target.delprovPdf) await seedMaFromSuDelprov(prov.id, target.delprovPdf);
  else if (target.splitMaB1) await splitMaDelprovB(prov.id);

  const facitMap: Record<string, string> = {};

  for (const bed of target.bedPdfs || []) {
    const bedPath = path.join(PROV_DIR, bed);
    if (!fs.existsSync(bedPath)) {
      console.warn(`  ⚠ Missing bed-PDF ${bed}`);
      continue;
    }
    const text = await extractPdfText(bedPath);
    if (prov.amne === 'Matematik') {
      Object.assign(facitMap, parseFacitMap(text));
    } else if (prov.amne === 'Biologi') {
      Object.assign(facitMap, parseNoBioFacit(text));
      const entries = parseGeoFacitEntries(text);
      for (const [k, v] of Object.entries(facitMapFromEntries(entries))) facitMap[String(k)] = v;
    } else if (prov.amne === 'Svenska') {
      Object.assign(facitMap, parseSvBedömningsunderlag(text));
    } else {
      Object.assign(facitMap, parseBedömningskriterierBlock(text));
    }
    const added = prov.amne === 'Matematik' ? Object.keys(parseFacitMap(text)).length : Object.keys(facitMap).length;
    console.log(`  📄 ${bed}: ${added} facit-rader`);
  }

  for (const code of target.texCodes || []) {
    const docText = extractDocxFromZip(zipPath, code);
    if (!docText || /SPSM|Specialpedagogiska/i.test(docText.slice(0, 500))) continue;
    Object.assign(facitMap, mergeFacitMaps(parseTexCodeFacit(docText), parseBedömningskriterierBlock(docText)));
  }

  if (!Object.keys(facitMap).length) {
    console.warn('  ⚠ No facit parsed');
    return 0;
  }

  const updated = await applyFacit(prov.id, facitMap, prov.amne);
  console.log(`  ✅ ~${updated} frågor uppdaterade (${Object.keys(facitMap).length} facit-nycklar)`);
  return updated;
}

async function main() {
  console.log(dryRun ? '🧪 Dry-run ZIP facit…' : '✅ Seeding ZIP facit…');
  let total = 0;
  const targets = slugFilter ? TARGETS.filter((t) => t.slug === slugFilter) : TARGETS;
  for (const t of targets) total += await seedTarget(t);
  console.log(`\n✅ ZIP facit done. Updated ~${total} frågor.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});