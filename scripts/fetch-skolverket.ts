/**
 * Fetch missing Skolverket/UU assets for all manifest subjects.
 *
 * Sources:
 *   - manifest.source_url (skolverket.se/download, uu.se/download, arkiv.edusci.umu.se)
 *   - UU Geografi åk 9 Delprov A+B 2013–2018 (public)
 *   - Local Gamla NP / data/raw mirrors (via fetch-pdfs index)
 *
 * Usage:
 *   npx tsx scripts/fetch-skolverket.ts
 *   npx tsx scripts/fetch-skolverket.ts --geo-only
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const geoOnly = process.argv.includes('--geo-only');
const dryRun = process.argv.includes('--dry-run');
const DEST = path.resolve('public/prov');
const MANIFEST_PATH = path.resolve('src/data/manifest.json');

const UU_GEO_BEDOMNING: { year: number; url: string; filename: string }[] = [
  {
    year: 2013,
    url: 'https://www.uu.se/download/18.45a71dce18e9df64db75f3/1712056160713/2013_Bed%C3%B6mningsanvisningar.pdf',
    filename: 'geo-ak9-2013-bedomningsanvisningar.pdf',
  },
  {
    year: 2014,
    url: 'https://www.uu.se/download/18.45a71dce18e9df64db75e9/1712056107767/2014%20Bed%C3%B6mningsanvisningar.pdf',
    filename: 'geo-ak9-2014-bedomningsanvisningar.pdf',
  },
  {
    year: 2015,
    url: 'https://www.uu.se/download/18.45a71dce18e9df64db75da/1712056030625/2015_Bed%C3%B6mningsanvisningar.pdf',
    filename: 'geo-ak9-2015-bedomningsanvisningar.pdf',
  },
  {
    year: 2016,
    url: 'https://www.uu.se/download/18.45a71dce18e9df64db75ca/1712055963241/2016_Bed%C3%B6mningsanvisningar.pdf',
    filename: 'geo-ak9-2016-bedomningsanvisningar.pdf',
  },
  {
    year: 2017,
    url: 'https://www.uu.se/download/18.45a71dce18e9df64db75bd/1712055895481/2017_Bed%C3%B6mningsanvisningar.pdf',
    filename: 'geo-ak9-2017-bedomningsanvisningar.pdf',
  },
  {
    year: 2018,
    url: 'https://www.uu.se/download/18.51414c891919758bd0326ca5/1725438521159/2018_Bed%C3%B6mningsanvisning.pdf',
    filename: 'geo-ak9-2018-bedomningsanvisningar.pdf',
  },
];

const UU_GEO_ENG: { year: number; a: string; b: string }[] = [
  { year: 2014, a: 'https://www.uu.se/download/18.45a71dce18e9df64db75e0/1712056057671/2014_Delprov%20A_eng.pdf', b: 'https://www.uu.se/download/18.45a71dce18e9df64db75e6/1712056096590/2014_Delprov%20B_eng.pdf' },
  { year: 2015, a: 'https://www.uu.se/download/18.45a71dce18e9df64db75d0/1712055995557/2015_Delprov%20A%20Eng.pdf', b: 'https://www.uu.se/download/18.45a71dce18e9df64db75d8/1712056021388/2015_Delprov%20B%20Eng.pdf' },
  { year: 2016, a: 'https://www.uu.se/download/18.45a71dce18e9df64db75c3/1712055924154/2016_Delprov%20A_eng.pdf', b: 'https://www.uu.se/download/18.45a71dce18e9df64db75c7/1712055948814/2016_Delprov%20B_eng.pdf' },
  { year: 2017, a: 'https://www.uu.se/download/18.45a71dce18e9df64db75b5/1712055846253/2017_Delprov%20A_eng.pdf', b: 'https://www.uu.se/download/18.45a71dce18e9df64db75ba/1712055879671/2017_Delprov%20B_eng.pdf' },
  { year: 2018, a: 'https://www.uu.se/download/18.51414c891919758bd0326b91/1725438114291/2018_Delprov_A_eng.pdf', b: 'https://www.uu.se/download/18.51414c891919758bd0326ca3/1725438506950/2018_Delprov_B_eng.pdf' },
];

const UU_GEO_AK6: { url: string; filename: string }[] = [
  { url: 'https://www.uu.se/download/18.45a71dce18e9df64db7611/1712056360519/%C3%85k%206%202013_Delprov%20A.pdf', filename: 'geo-ak6-2013-delprov-a.pdf' },
  { url: 'https://www.uu.se/download/18.45a71dce18e9df64db769c/1712056373207/%C3%85k%206%202013_Delprov%20B.pdf', filename: 'geo-ak6-2013-delprov-b.pdf' },
  { url: 'https://www.uu.se/download/18.45a71dce18e9df64db76a0/1712056388685/%C3%85k%206%202013_Kartblad.pdf', filename: 'geo-ak6-2013-kartblad.pdf' },
  { url: 'https://www.uu.se/download/18.45a71dce18e9df64db76a2/1712056404245/%C3%85k%206%202013_Bed%C3%B6mningsanvisningar.pdf', filename: 'geo-ak6-2013-bedomningsanvisningar.pdf' },
  { url: 'https://www.uu.se/download/18.45a71dce18e9df64db7608/1712056319931/%C3%85k%206%202014_Delprov%20A.pdf', filename: 'geo-ak6-2014-delprov-a.pdf' },
  { url: 'https://www.uu.se/download/18.45a71dce18e9df64db760a/1712056333436/%C3%85k%206%202014_Delprov%20B.pdf', filename: 'geo-ak6-2014-delprov-b.pdf' },
  { url: 'https://www.uu.se/download/18.45a71dce18e9df64db760f/1712056347085/%C3%85k%206%202014_Bed%C3%B6mningsanvisningar.pdf', filename: 'geo-ak6-2014-bedomningsanvisningar.pdf' },
  { url: 'https://www.uu.se/download/18.45a71dce18e9df64db7129a/1712067684157/%C3%85k%206%20Bed%C3%B6mningsst%C3%B6d%202015%20Delprov%20A.pdf', filename: 'geo-ak6-2015-delprov-a.pdf' },
  { url: 'https://www.uu.se/download/18.45a71dce18e9df64db7129d/1712067714640/%C3%85k%206%20Bed%C3%B6mningsst%C3%B6d%202015%20Delprov%20B.pdf', filename: 'geo-ak6-2015-delprov-b.pdf' },
  { url: 'https://www.uu.se/download/18.45a71dce18e9df64db712a3/1712067740011/%C3%85k%206%20Bed%C3%B6mningsst%C3%B6d%202015%20Bed%C3%B6mningsanvisningar.pdf', filename: 'geo-ak6-2015-bedomningsanvisningar.pdf' },
  { url: 'https://www.uu.se/download/18.45a71dce18e9df64db75f8/1712056220672/%C3%85k%206%20Bed%C3%B6mningsst%C3%B6d%20Msk%20Natur_L%C3%A4rarinformation.pdf', filename: 'geo-ak6-2017-msk-natur-lararinfo.pdf' },
  { url: 'https://www.uu.se/download/18.45a71dce18e9df64db75fb/1712056242539/%C3%85k%206%20Bed%C3%B6mningsst%C3%B6d%20Msk%20Natur_Elevh%C3%A4fte.pdf', filename: 'geo-ak6-2017-msk-natur-elevhäfte.pdf' },
  { url: 'https://www.uu.se/download/18.45a71dce18e9df64db75fd/1712056257311/%C3%85k%206%20Bed%C3%B6mningsst%C3%B6d%20Msk%20Natur_Bed%C3%B6mningsanvisningar.pdf', filename: 'geo-ak6-2017-msk-natur-bedomning.pdf' },
  { url: 'https://www.uu.se/download/18.45a71dce18e9df64db7601/1712056272047/%C3%85k%206%20Bed%C3%B6mningsst%C3%B6d%20Global%20V%C3%A4rld_L%C3%A4rarinformation.pdf', filename: 'geo-ak6-2017-global-lararinfo.pdf' },
  { url: 'https://www.uu.se/download/18.45a71dce18e9df64db7603/1712056287019/%C3%85k%206%20Bed%C3%B6mningsst%C3%B6d%20Global%20V%C3%A4rld_Elevh%C3%A4fte.pdf', filename: 'geo-ak6-2017-global-elevhäfte.pdf' },
  { url: 'https://www.uu.se/download/18.45a71dce18e9df64db7605/1712056301889/%C3%85k%206%20Bed%C3%B6mningsst%C3%B6d%20Global%20V%C3%A4rld_Bed%C3%B6mningsanvisning.pdf', filename: 'geo-ak6-2017-global-bedomning.pdf' },
];

const UU_GEO_KARTA: { year: number; url: string; filename: string }[] = [
  {
    year: 2013,
    url: 'https://www.uu.se/download/18.45a71dce18e9df64db75f1/1712056145502/2013_Karth%C3%A4fte.pdf',
    filename: 'geo-ak9-2013-karthäfte.pdf',
  },
];

/** Åk 9 2019 — lägg till när UU publicerar (sekretess förlängd till 2026-06-30, inga länkar än 2026-07-15) */
const UU_GEO_2019: { year: number; a?: string; b?: string; bed?: string }[] = [];

const UU_GEO_DELPROV: { year: number; a: string; b: string }[] = [
  {
    year: 2013,
    a: 'https://www.uu.se/download/18.45a71dce18e9df64db75eb/1712056121005/2013_Delprov%20A.pdf',
    b: 'https://www.uu.se/download/18.45a71dce18e9df64db75ef/1712056132241/2013_Delprov%20B.pdf',
  },
  {
    year: 2014,
    a: 'https://www.uu.se/download/18.45a71dce18e9df64db75dc/1712056044541/2014_Delprov%20A.pdf',
    b: 'https://www.uu.se/download/18.45a71dce18e9df64db75e4/1712056074730/2014_Delprov%20B.pdf',
  },
  {
    year: 2015,
    a: 'https://www.uu.se/download/18.45a71dce18e9df64db75cc/1712055979322/2015_Delprov%20A.pdf',
    b: 'https://www.uu.se/download/18.45a71dce18e9df64db75d4/1712056007428/2015_Delprov%20B.pdf',
  },
  {
    year: 2016,
    a: 'https://www.uu.se/download/18.45a71dce18e9df64db75bf/1712055910398/2016_Delprov%20A.pdf',
    b: 'https://www.uu.se/download/18.45a71dce18e9df64db75c5/1712055936974/2016_Delprov%20B.pdf',
  },
  {
    year: 2017,
    a: 'https://www.uu.se/download/18.45a71dce18e9df64db720c/1712050751364/2017_Delprov%20A.pdf',
    b: 'https://www.uu.se/download/18.45a71dce18e9df64db75b7/1712055863110/2017_Delprov%20B.pdf',
  },
  {
    year: 2018,
    a: 'https://www.uu.se/download/18.51414c891919758bd0326b8f/1725438030655/2018_Delprov_A.pdf',
    b: 'https://www.uu.se/download/18.51414c891919758bd0326c9f/1725438477856/2018_Delprov_B.pdf',
  },
];

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

async function download(url: string, dest: string): Promise<boolean> {
  if (fs.existsSync(dest)) return true;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'npprov.se-astro/1.0 (educational archive)' },
    redirect: 'follow',
  });
  if (!res.ok) {
    console.warn(`  ✗ HTTP ${res.status} ${url}`);
    return false;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500) return false;
  if (!dryRun) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
  }
  return true;
}

async function fetchManifestUrls() {
  const manifest: {
    id: string;
    original_filename?: string;
    source_url?: string;
    files?: { name?: string }[];
  }[] = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const item of manifest) {
    const filename =
      item.original_filename || item.files?.[0]?.name;
    const url = item.source_url || '';
    if (!filename || !url) continue;
    if (!/skolverket\.se\/download|uu\.se\/download|arkiv\.edusci\.umu\.se/i.test(url)) continue;

    const dest = path.join(DEST, filename);
    if (fs.existsSync(dest)) {
      skip++;
      continue;
    }

    const got = await download(url, dest);
    if (got) {
      ok++;
      console.log(`  ⬇️  ${filename}`);
      if (supabase && !dryRun) {
        const patch = /\.zip$/i.test(filename)
          ? { zip_url: `/prov/${filename}` }
          : { pdf_url: `/prov/${filename}` };
        await supabase.from('prov').update(patch).eq('slug', item.id);
      }
    } else {
      fail++;
    }
  }

  console.log(`Manifest URLs: downloaded ${ok}, skipped ${skip}, failed ${fail}`);
}

async function fetchGeoExtras(
  items: { year: number; url: string; filename: string }[],
  label: string
) {
  let n = 0;
  for (const { filename, url } of items) {
    const dest = path.join(DEST, filename);
    if (await download(url, dest)) {
      if (dryRun || fs.existsSync(dest)) {
        console.log(`  🌍 ${filename}`);
        n++;
      }
    }
  }
  console.log(`UU Geografi ${label}: ${n} files ready`);
}

async function fetchGeoYears() {
  let n = 0;
  for (const { year, a, b } of UU_GEO_DELPROV) {
    for (const [letter, url] of [
      ['a', a],
      ['b', b],
    ] as const) {
      const name = `geo-ak9-${year}-delprov-${letter}.pdf`;
      const dest = path.join(DEST, name);
      if (await download(url, dest)) {
        if (!fs.existsSync(dest) && !dryRun) continue;
        if (!dryRun && !fs.existsSync(dest)) n++;
        else if (dryRun || fs.existsSync(dest)) {
          console.log(`  🌍 ${name}`);
          n++;
        }
      }
    }
  }
  console.log(`UU Geografi delprov: ${n} files ready`);
}

async function main() {
  fs.mkdirSync(DEST, { recursive: true });
  console.log('📥 fetch-skolverket…');
  await fetchGeoYears();
  await fetchGeoExtras(UU_GEO_BEDOMNING, 'bedömningsanvisningar');
  await fetchGeoExtras(UU_GEO_KARTA, 'kartmaterial');
  for (const { year, a, b } of UU_GEO_ENG) {
    for (const [letter, url] of [['a', a], ['b', b]] as const) {
      const name = `geo-ak9-${year}-delprov-${letter}-eng.pdf`;
      const dest = path.join(DEST, name);
      if (await download(url, dest) && (dryRun || fs.existsSync(dest))) {
        console.log(`  🌍 ${name}`);
      }
    }
  }
  console.log('UU Geografi engelska: done');
  for (const { url, filename } of UU_GEO_AK6) {
    const dest = path.join(DEST, filename);
    if (await download(url, dest) && (dryRun || fs.existsSync(dest))) {
      console.log(`  🌍 ${filename}`);
    }
  }
  console.log('UU Geografi åk 6: done');
  if (!UU_GEO_2019.length) {
    console.log(
      '⏳ GEO åk 9 2019: inga UU-URL:er konfigurerade än (kolla https://www.uu.se/nationella-prov/geografi/aldre-prov-och-bedomningsstod)'
    );
  }
  if (!geoOnly) await fetchManifestUrls();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});