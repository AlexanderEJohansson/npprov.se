/**
 * Seed Geografi åk 6 from UU PDFs (2013–2017 bedömningsstöd).
 *
 * Usage: npx tsx scripts/seed-geo-ak6-pdfs.ts [--dry-run]
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';
import { parseGeografiThemeSections } from './lib/geo-parse';
import { sanitizeDbText, sanitizePdfText } from './lib/sanitize-text';

const dryRun = process.argv.includes('--dry-run');
const PROV_DIR = path.resolve('public/prov');
const UU_URL = 'https://www.uu.se/nationella-prov/geografi/aldre-prov-och-bedomningsstod';

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const AK6_PROV = [
  { year: 2013, slug: 'geo-ak6-2013', files: ['geo-ak6-2013-delprov-a.pdf', 'geo-ak6-2013-delprov-b.pdf'] },
  { year: 2014, slug: 'geo-ak6-2014', files: ['geo-ak6-2014-delprov-a.pdf', 'geo-ak6-2014-delprov-b.pdf'] },
  { year: 2015, slug: 'geo-ak6-2015', files: ['geo-ak6-2015-delprov-a.pdf', 'geo-ak6-2015-delprov-b.pdf'] },
  { year: 2017, slug: 'geo-ak6-2017-msk', files: ['geo-ak6-2017-msk-natur-elevhäfte.pdf'], titel: 'Geografi åk 6 2016/2017 – Människa och natur' },
  { year: 2017, slug: 'geo-ak6-2017-global', files: ['geo-ak6-2017-global-elevhäfte.pdf'], titel: 'Geografi åk 6 2016/2017 – En global värld' },
] as const;

async function extractPdfText(filePath: string): Promise<string> {
  const buf = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  await parser.destroy();
  return sanitizePdfText(result.text);
}

async function main() {
  console.log(dryRun ? '🧪 Dry-run geo åk 6…' : '🌍 Seeding Geografi åk 6…');
  let total = 0;

  for (const entry of AK6_PROV) {
    const existing = await supabase.from('prov').select('id').eq('slug', entry.slug).maybeSingle();
    let provId = existing.data?.id;

    const pdf = entry.files.find((f) => fs.existsSync(path.join(PROV_DIR, f)));
    if (!pdf) {
      console.warn(`  ⚠ No PDF for ${entry.slug}`);
      continue;
    }

    const row = {
      slug: entry.slug,
      ar: entry.year,
      amne: 'Geografi' as const,
      arskurs_kurs: 'ak6' as const,
      typ: 'delprov' as const,
      titel: 'titel' in entry ? entry.titel : `Geografi åk 6 ${entry.year - 1}/${entry.year}`,
      kalla: 'Uppsala universitet',
      kalla_url: UU_URL,
      pdf_url: `/prov/${pdf}`,
      metadata: { sprak: 'sv', niva: 'ak6' },
    };

    if (!dryRun) {
      if (provId) {
        await supabase.from('prov').update(row).eq('id', provId);
      } else {
        const { data, error } = await supabase.from('prov').insert(row).select('id').single();
        if (error) throw error;
        provId = data.id;
      }
    }

    for (const [i, file] of entry.files.entries()) {
      const full = path.join(PROV_DIR, file);
      if (!fs.existsSync(full)) continue;
      const text = await extractPdfText(full);
      const seeds = parseGeografiThemeSections(text, entry.year);
      const beteckning = entry.files.length > 1 ? `Delprov ${i === 0 ? 'A' : 'B'}` : 'Elevhäfte';
      if (!seeds.length) {
        seeds.push({
          fraga_nummer: '1',
          typ: 'ovrigt',
          text: `Geografi åk 6 – ${beteckning}. Fullständigt innehåll i PDF (parsning pågår).`,
          kalla: `Uppsala universitet (Geografi åk 6, ${entry.year})`,
        });
      }

      if (!dryRun && provId) {
        let delprovId: string | undefined;
        const { data: existingDp } = await supabase
          .from('delprov')
          .select('id')
          .eq('prov_id', provId)
          .eq('beteckning', beteckning)
          .maybeSingle();
        if (existingDp?.id) {
          delprovId = existingDp.id;
          await supabase.from('delprov').update({ pdf_url: `/prov/${file}` }).eq('id', delprovId);
        } else {
          const { data: created } = await supabase
            .from('delprov')
            .insert({ prov_id: provId, beteckning, titel: beteckning, ordning: i + 1, pdf_url: `/prov/${file}` })
            .select('id')
            .single();
          delprovId = created?.id;
        }
        if (!delprovId) continue;

        for (const seed of seeds) {
          const { data: ex } = await supabase
            .from('fraga')
            .select('id')
            .eq('delprov_id', delprovId)
            .eq('fraga_nummer', seed.fraga_nummer)
            .maybeSingle();
          const fragaRow = {
            delprov_id: delprovId,
            fraga_nummer: seed.fraga_nummer,
            typ: seed.typ,
            text: sanitizeDbText(seed.text) || seed.fraga_nummer,
            human_reviewed: false,
            kalla: seed.kalla,
          };
          if (ex?.id) await supabase.from('fraga').update(fragaRow).eq('id', ex.id);
          else await supabase.from('fraga').insert(fragaRow);
          total++;
        }
      } else {
        total += seeds.length;
      }
      console.log(`  ${entry.slug} / ${file}: ${seeds.length} frågor`);
    }
  }

  console.log(`\n✅ Geo åk 6 seed done. Touched ~${total} frågor.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});