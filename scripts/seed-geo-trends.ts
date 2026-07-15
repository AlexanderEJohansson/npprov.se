/**
 * Seed trend_analys rows for Geografi åk 9 (2013–2018).
 *
 * Usage: npx tsx scripts/seed-geo-trends.ts [--dry-run]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const dryRun = process.argv.includes('--dry-run');
const UU_URL = 'https://www.uu.se/nationella-prov/geografi/aldre-prov-och-bedomningsstod';

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ROWS = [
  {
    ar: 2018,
    trend_kommentar:
      'Ökad andel kart- och källkritiska uppgifter kopplade till hållbar utveckling och globala processer (UU Delprov B).',
    forvantad_svarighet_gy25: 'Stabil – fler tvärdisciplinära resonemangsuppgifter',
  },
  {
    ar: 2016,
    trend_kommentar:
      'Tydlig tematisk struktur Delprov B (konsumtion, klimat, elektronikavfall) – stark koppling till GEO9.1.1.',
    forvantad_svarighet_gy25: 'Medel–hög resonemang i Delprov B',
  },
  {
    ar: 2013,
    trend_kommentar:
      'Tidigt Lgr11-material med kartmatchning och befolkningsfördelning – fortfarande relevant för begreppsförståelse.',
    forvantad_svarighet_gy25: 'Grundläggande kartkunskap + kort svar',
  },
];

async function main() {
  console.log(dryRun ? '🧪 Dry-run geo trends…' : '📈 Seeding Geografi trends…');

  for (const r of ROWS) {
    const row = {
      amne: 'Geografi',
      arskurs_kurs: 'ak9',
      ar: r.ar,
      medelresultat: null,
      andel_godkant: null,
      svarighetsindex: null,
      forvantad_svarighet_gy25: r.forvantad_svarighet_gy25,
      trend_kommentar: r.trend_kommentar,
      kalla: 'npprov.se intern analys + UU bedömningsunderlag',
      kalla_url: UU_URL,
      last_updated: new Date().toISOString(),
    };

    if (!dryRun) {
      await supabase.from('trend_analys').upsert(row, { onConflict: 'amne,ar' });
    }
    console.log(`  ✓ ${r.ar}: ${r.trend_kommentar.slice(0, 60)}…`);
  }

  console.log('\n✅ Geo trends seeded.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});