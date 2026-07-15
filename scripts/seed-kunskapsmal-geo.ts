/**
 * Upsert GEO9 + SA9 kunskapskrav for genome / NP-Monstret deep links.
 *
 * Usage: npx tsx scripts/seed-kunskapsmal-geo.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EXTRA_KM = [
  {
    kod: 'GEO9.1.1',
    kurs: 'Geografi åk 9',
    beskrivning:
      'Eleven kan med ett kritiskt förhållningssätt och med kunskaper om natur, miljö, befolkning, samhälle, kultur, ekonomi och politik analysera och värdera hållbar utveckling i olika delar av världen.',
    lgr22_gy25_referens: 'Lgr22 2.2.1',
    amne: 'Geografi',
    arskurs_kurs: 'ak9',
  },
  {
    kod: 'GEO9.2.1',
    kurs: 'Geografi åk 9',
    beskrivning:
      'Eleven kan använda geografins begrepp, modeller och teorier för att beskriva och analysera platser, landskap och regioner samt människans användning av dem.',
    lgr22_gy25_referens: 'Lgr22 2.2.2',
    amne: 'Geografi',
    arskurs_kurs: 'ak9',
  },
  {
    kod: 'GEO9.3.1',
    kurs: 'Geografi åk 9',
    beskrivning:
      'Eleven kan använda geografiska källor och arbeta med geografiska undersökningsmetoder för att ta reda på, värdera och presentera geografisk information.',
    lgr22_gy25_referens: 'Lgr22 2.2.3',
    amne: 'Geografi',
    arskurs_kurs: 'ak9',
  },
  {
    kod: 'SA9.1.1',
    kurs: 'Samhällskunskap åk 9',
    beskrivning:
      'Eleven kan söka, granska och värdera källor med en källkritisk metod samt använda informationen för att formulera och bemöta argument i samhällsfrågor.',
    lgr22_gy25_referens: 'Lgr22 2.2.1',
    amne: 'Samhällskunskap',
    arskurs_kurs: 'ak9',
  },
  {
    kod: 'SA9.2.1',
    kurs: 'Samhällskunskap åk 9',
    beskrivning:
      'Eleven kan analysera samhällsstrukturer och samhällsfenomen med hjälp av samhällskunskapliga begrepp och modeller.',
    lgr22_gy25_referens: 'Lgr22 2.2.2',
    amne: 'Samhällskunskap',
    arskurs_kurs: 'ak9',
  },
];

async function main() {
  let n = 0;
  for (const km of EXTRA_KM) {
    const { error } = await supabase.from('kunskapsmal').upsert(km, { onConflict: 'kod' });
    if (error) console.warn(km.kod, error.message);
    else n++;
  }
  console.log(`✅ Upserted ${n} kunskapskrav (GEO9 + SA9).`);
}

main().catch(console.error);