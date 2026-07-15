/**
 * Split combined Geografi åk 9 archive into one prov row per läsår (2013–2018).
 * Preserves delprov + fraga rows by reassigning prov_id.
 *
 * Usage: npx tsx scripts/split-geo-by-year.ts [--dry-run]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const dryRun = process.argv.includes('--dry-run');
const LEGACY_SLUG = 'a8f3c2e91b';
const UU_URL = 'https://www.uu.se/nationella-prov/geografi/aldre-prov-och-bedomningsstod';

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const YEARS = [2013, 2014, 2015, 2016, 2017, 2018] as const;

function extraFiles(year: number) {
  const files: { label: string; url: string; lang?: string }[] = [
    { label: 'Bedömningsanvisningar', url: `/prov/geo-ak9-${year}-bedomningsanvisningar.pdf` },
  ];
  if (year === 2013) {
    files.push({ label: 'Karthäfte', url: '/prov/geo-ak9-2013-karthäfte.pdf' });
  }
  if (year >= 2014) {
    files.push(
      { label: 'Delprov A (engelska)', url: `/prov/geo-ak9-${year}-delprov-a-eng.pdf`, lang: 'en' },
      { label: 'Delprov B (engelska)', url: `/prov/geo-ak9-${year}-delprov-b-eng.pdf`, lang: 'en' }
    );
  }
  return files;
}

async function main() {
  console.log(dryRun ? '🧪 Dry-run split geo by year…' : '🌍 Splitting Geografi åk 9 by year…');

  const { data: legacy } = await supabase.from('prov').select('id').eq('slug', LEGACY_SLUG).maybeSingle();
  if (!legacy?.id) throw new Error(`Legacy prov ${LEGACY_SLUG} not found`);

  const { data: allDps } = await supabase.from('delprov').select('id, beteckning, ordning').eq('prov_id', legacy.id);

  for (const year of YEARS) {
    const slug = `geo-ak9-${year}`;
    const lasar = `${year - 1}/${year}`;
    const titel = `Geografi åk 9 ${lasar}`;

    const { data: existing } = await supabase.from('prov').select('id').eq('slug', slug).maybeSingle();
    let provId = existing?.id;

    const row = {
      slug,
      ar: year,
      termin: null as string | null,
      amne: 'Geografi' as const,
      arskurs_kurs: 'ak9' as const,
      typ: 'delprov' as const,
      titel,
      kalla: 'Uppsala universitet',
      kalla_url: UU_URL,
      pdf_url: `/prov/geo-ak9-${year}-delprov-a.pdf`,
      zip_url: null,
      antal_delprov: 2,
      metadata: {
        lasar,
        sprak: 'sv',
        extra_files: extraFiles(year),
        legacy_slug: LEGACY_SLUG,
      },
    };

    if (!dryRun) {
      if (provId) {
        await supabase.from('prov').update(row).eq('id', provId);
      } else {
        const { data: created, error } = await supabase.from('prov').insert(row).select('id').single();
        if (error) throw error;
        provId = created.id;
      }
    }

    const yearDps = (allDps || []).filter((d) => d.beteckning.includes(`(${year})`));
    for (const dp of yearDps) {
      const letter = /Delprov B/i.test(dp.beteckning) ? 'b' : 'a';
      const patch = {
        prov_id: provId,
        pdf_url: `/prov/geo-ak9-${year}-delprov-${letter}.pdf`,
      };
      if (!dryRun && provId) {
        await supabase.from('delprov').update(patch).eq('id', dp.id);
      }
      console.log(`  ${year} ← ${dp.beteckning}`);
    }
  }

  if (!dryRun) {
    await supabase
      .from('prov')
      .update({
        titel: 'Geografi åk 9 – arkiv (alla år)',
        typ: 'ovrigt',
        metadata: {
          redirect_to: '/prov/geo-ak9-2018',
          ar_span: '2013–2018',
          archive_index: YEARS.map((y) => `geo-ak9-${y}`),
        },
      })
      .eq('id', legacy.id);
  }

  console.log('\n✅ Split complete. Legacy slug kept as archive index.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});