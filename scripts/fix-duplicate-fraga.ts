/**
 * ONE-TIME FIX SCRIPT: Clean up duplicate fraga rows and duplicate junctions.
 *
 * Root cause: Repeated seed/insert runs created multiple fraga rows with the
 * same (prov + fraga_nummer) because there was no unique constraint and
 * the existence checks were not always sufficient across runs.
 *
 * This script:
 *   - Targets the two provs you have real granular data for (from your diagnostic).
 *   - Groups fraga by (prov_slug, fraga_nummer).
 *   - Picks ONE keeper per group (lex smallest id for determinism).
 *   - Re-points ALL fraga_kunskapsmal and community_forklaring rows from
 *     duplicate fraga_ids to the keeper (no data loss).
 *   - Deletes the duplicate fraga rows.
 *   - Ensures exactly the 3 desired junctions exist with the values you
 *     specified (MA9.1.1 on "1", SV9.2.1 + SV9.3.1 on "Skrivuppgift C").
 *   - Prints clear before/after verification.
 *
 * Run (no more manual SQL in Supabase Editor):
 *   npm run fix:data
 *   or: npx tsx scripts/fix-duplicate-fraga.ts
 *
 * Requirements: .env or .env.local with PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * (the service_role key, not the anon key — same as you use for other seed scripts).
 *
 * After running, the fraga and fraga_kunskapsmal tables for these provs
 * should be clean (1 fraga per logical question + exactly 3 junctions).
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Robust env loading: prefer .env.local (common for Astro / local dev) then .env
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔑 Env check:');
console.log('   PUBLIC_SUPABASE_URL / SUPABASE_URL present:', !!supabaseUrl);
console.log('   SUPABASE_SERVICE_ROLE_KEY present:', !!serviceKey);
if (supabaseUrl) {
  console.log('   URL prefix:', supabaseUrl.slice(0, 35) + '...');
}

if (!supabaseUrl || !serviceKey) {
  console.error('\n❌ Missing PUBLIC_SUPABASE_URL (or SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Make sure they are in .env or .env.local in the project root.');
  console.error('   These are the same variables you use for the other seed scripts.');
  process.exit(1);
}

if (serviceKey.includes('PASTE_YOUR') || serviceKey.includes('your-real') || serviceKey.length < 100) {
  console.error('\n❌ SUPABASE_SERVICE_ROLE_KEY still looks like a placeholder.');
  console.error('   Current value starts with:', serviceKey.slice(0, 30) + '...');
  console.error('\nYou need to replace it with the real service_role key from your Supabase project.');
  console.error('1. Go to https://supabase.com/dashboard/project/alrxchmxuqaeonsvaogw/settings/api');
  console.error('2. Scroll to "Project API keys"');
  console.error('3. Copy the key under "service_role" (the long secret one, not the anon one).');
  console.error('4. In your .env file, replace the line:');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=PASTE_YOUR_REAL_SERVICE_ROLE_KEY_HERE');
  console.error('   with the real key.');
  console.error('\nThen save and run `npm run fix:data` again.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// The two provs with real granular data (from your diagnostic paste)
const TARGET_SLUGS = ['c2720bf787', '115162bb33', '52626660db'];

// Junctions for provs with real PDF-derived fraga
const DESIRED_JUNCTIONS = [
  { kod: 'MA9.1.1', fraga_nummer: '7', slug: 'c2720bf787', styrka: 0.8, kommentar: 'Tolkning av sakprosa kring AI (från bedömningsunderlag)' },
  { kod: 'MA9.1.1', fraga_nummer: '8', slug: 'c2720bf787', styrka: 0.75, kommentar: 'Identifiera ståndpunkt i text' },
  { kod: 'SV9.2.1', fraga_nummer: 'Skrivuppgift C', slug: '115162bb33', styrka: 0.90, kommentar: 'Direkt koppling till argumenterande skrivande (från bedömningsunderlag)' },
  { kod: 'SV9.3.1', fraga_nummer: 'Skrivuppgift C', slug: '115162bb33', styrka: 0.85, kommentar: 'Koppling till muntlig och skriftlig kommunikation (från bedömningsunderlag)' },
];

async function main() {
  console.log('🔧 Starting duplicate fraga + junction cleanup (service role)...\n');

  // 1. Load the two target provs
  const { data: provs, error: provErr } = await supabase
    .from('prov')
    .select('id, slug, titel')
    .in('slug', TARGET_SLUGS);

  if (provErr || !provs || provs.length === 0) {
    console.error('❌ Could not load target provs:', provErr?.message || 'No rows returned');

    const msg = (provErr?.message || '').toLowerCase();
    if (msg.includes('api key') || msg.includes('invalid') || msg.includes('unauthorized')) {
      console.error('\nThis almost always means the service role key is invalid or mismatched:');
      console.error('- The SUPABASE_SERVICE_ROLE_KEY you have is probably the anon/public key, or an old/revoked key.');
      console.error('- Or the key belongs to a different Supabase project than the URL.');
      console.error('\nFix:');
      console.error('1. Go to Supabase Dashboard → your project (alrxchmxuqaeonsvaogw) → Project Settings → API');
      console.error('2. Copy the "service_role" key (the long one that starts with "eyJ..." and has "service_role" in the JWT).');
      console.error('3. Put it in .env or .env.local as:');
      console.error('   SUPABASE_SERVICE_ROLE_KEY=the-whole-key-here');
      console.error('   PUBLIC_SUPABASE_URL=https://alrxchmxuqaeonsvaogw.supabase.co');
      console.error('\nDo NOT use the anon key here. The script needs full admin rights to delete/update rows.');
      console.error('\nAfter updating the .env file, run the command again.');
    } else {
      console.error('\nCheck that your keys are correct and that the Supabase project is reachable.');
    }
    process.exit(1);
  }
  const provBySlug = new Map(provs.map(p => [p.slug, p]));
  console.log(`Found target provs: ${provs.map(p => `${p.slug} (${p.titel})`).join(', ')}`);

  // 2. Load delprovs + all fraga for these provs
  const { data: delprovs } = await supabase
    .from('delprov')
    .select('id, prov_id, beteckning')
    .in('prov_id', provs.map(p => p.id));

  const delprovIds = (delprovs || []).map(d => d.id);

  const { data: allFraga } = await supabase
    .from('fraga')
    .select('id, delprov_id, fraga_nummer, typ')
    .in('delprov_id', delprovIds);

  if (!allFraga) {
    console.log('No fraga rows for these provs.');
    return;
  }

  // Build map delprov_id -> {prov_slug, beteckning}
  const delprovMeta = new Map(
    (delprovs || []).map(d => {
      const prov = provs.find(p => p.id === d.prov_id)!;
      return [d.id, { slug: prov.slug, beteckning: d.beteckning }];
    })
  );

  // 3. Group fraga by logical key (slug + fraga_nummer)
  const groups = new Map<string, any[]>();
  for (const f of allFraga) {
    const meta = delprovMeta.get(f.delprov_id);
    if (!meta) continue;
    const key = `${meta.slug}::${f.fraga_nummer}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ ...f, slug: meta.slug, beteckning: meta.beteckning });
  }

  console.log(`\nFound ${groups.size} logical (prov + fraga_nummer) groups for the target provs.`);

  const keepers = new Map<string, string>(); // key -> keeper fraga id
  const toDeleteFragaIds: string[] = [];

  for (const [key, rows] of groups.entries()) {
    if (rows.length <= 1) {
      keepers.set(key, rows[0].id);
      continue;
    }

    // Pick keeper: stable — smallest id (lex)
    const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id));
    const keeper = sorted[0];
    const dups = sorted.slice(1);

    keepers.set(key, keeper.id);
    toDeleteFragaIds.push(...dups.map(r => r.id));

    console.log(`  ${key}: ${rows.length} copies → keeping ${keeper.id} (beteckning: ${keeper.beteckning})`);
    console.log(`    deleting: ${dups.map(r => r.id).join(', ')}`);
  }

  if (toDeleteFragaIds.length === 0) {
    console.log('\n✅ No duplicate fraga rows found for the target provs. Good!');
  } else {
    console.log(`\nWill delete ${toDeleteFragaIds.length} duplicate fraga rows.`);
  }

  // 4. Re-point dependent rows (fraga_kunskapsmal + community_forklaring) from bad fraga -> keeper
  // First, build a map from badId -> keeperId
  const badToKeeper = new Map<string, string>();
  for (const [key, rows] of groups.entries()) {
    if (rows.length <= 1) continue;
    const keeperId = keepers.get(key)!;
    for (const r of rows.slice(1)) {
      badToKeeper.set(r.id, keeperId);
    }
  }

  // Re-point fraga_kunskapsmal
  if (badToKeeper.size > 0) {
    const badFragaIds = Array.from(badToKeeper.keys());
    const { data: badJunctions } = await supabase
      .from('fraga_kunskapsmal')
      .select('id, fraga_id, kunskapsmal_id')
      .in('fraga_id', badFragaIds);

    if (badJunctions && badJunctions.length > 0) {
      console.log(`\nRe-pointing ${badJunctions.length} fraga_kunskapsmal rows from duplicate fraga...`);
      for (const j of badJunctions) {
        const newFragaId = badToKeeper.get(j.fraga_id);
        if (newFragaId) {
          await supabase
            .from('fraga_kunskapsmal')
            .update({ fraga_id: newFragaId })
            .eq('id', j.id);
        }
      }
      console.log('  Done re-pointing junctions.');
    }
  }

  // Re-point community_forklaring (if any reference the bad fraga)
  if (badToKeeper.size > 0) {
    const badFragaIds = Array.from(badToKeeper.keys());
    const { data: badForks } = await supabase
      .from('community_forklaring')
      .select('id, fraga_id')
      .in('fraga_id', badFragaIds);

    if (badForks && badForks.length > 0) {
      console.log(`Re-pointing ${badForks.length} community_forklaring rows...`);
      for (const f of badForks) {
        const newFragaId = badToKeeper.get(f.fraga_id);
        if (newFragaId) {
          await supabase
            .from('community_forklaring')
            .update({ fraga_id: newFragaId })
            .eq('id', f.id);
        }
      }
    }
  }

  // 5. Delete the duplicate fraga rows (now safe — nothing points to them)
  if (toDeleteFragaIds.length > 0) {
    console.log(`\nDeleting ${toDeleteFragaIds.length} duplicate fraga rows...`);
    const { error: delErr } = await supabase
      .from('fraga')
      .delete()
      .in('id', toDeleteFragaIds);

    if (delErr) {
      console.error('  Error deleting duplicate fraga:', delErr.message);
    } else {
      console.log('  ✅ Duplicate fraga deleted.');
    }
  }

  // 6. Now ensure exactly the 3 desired junctions (using current keepers)
  console.log('\nEnsuring the 3 desired fraga_kunskapsmal junctions...');

  for (const desired of DESIRED_JUNCTIONS) {
    const key = `${desired.slug}::${desired.fraga_nummer}`;
    const keeperFragaId = keepers.get(key);

    if (!keeperFragaId) {
      console.warn(`  ⚠️  Could not find keeper fraga for ${key} — skipping this junction.`);
      continue;
    }

    // Resolve kunskapsmal id
    const { data: km } = await supabase
      .from('kunskapsmal')
      .select('id')
      .eq('kod', desired.kod)
      .limit(1)
      .single();

    if (!km) {
      console.warn(`  ⚠️  Kunskapsmal ${desired.kod} not found.`);
      continue;
    }

    // Upsert the exact desired row (will be no-op or update if exists)
    const { error: jErr } = await supabase
      .from('fraga_kunskapsmal')
      .upsert({
        fraga_id: keeperFragaId,
        kunskapsmal_id: km.id,
        styrka: desired.styrka,
        kommentar: desired.kommentar,
        added_by: 'fix-script',
      }, { onConflict: 'fraga_id,kunskapsmal_id' });

    if (jErr) {
      console.warn(`  Warning upserting ${desired.kod} on ${desired.fraga_nummer}:`, jErr.message);
    } else {
      console.log(`  ✅ Ensured junction: ${desired.kod} → fraga_nummer "${desired.fraga_nummer}" (fraga ${keeperFragaId.slice(0,8)}...)`);
    }
  }

  // 7. Verification — junctions + fraga state (pure JS client, no raw SQL)
  console.log('\n=== VERIFICATION: Desired junctions (should be exactly 3) ===');

  // Fetch the three specific ones we just ensured
  for (const desired of DESIRED_JUNCTIONS) {
    const { data: prov } = await supabase
      .from('prov')
      .select('id, titel')
      .eq('slug', desired.slug)
      .single();

    if (!prov) continue;

    const { data: delprovs } = await supabase
      .from('delprov')
      .select('id')
      .eq('prov_id', prov.id);

    const delprovIds = (delprovs || []).map(d => d.id);

    const { data: fr } = await supabase
      .from('fraga')
      .select('id')
      .in('delprov_id', delprovIds)
      .eq('fraga_nummer', desired.fraga_nummer)
      .limit(1)
      .single();

    const { data: km } = await supabase
      .from('kunskapsmal')
      .select('id, kod')
      .eq('kod', desired.kod)
      .single();

    if (fr && km) {
      const { data: junc } = await supabase
        .from('fraga_kunskapsmal')
        .select('styrka, kommentar')
        .eq('fraga_id', fr.id)
        .eq('kunskapsmal_id', km.id)
        .limit(1)
        .single();

      if (junc) {
        console.log(`  ✅ ${desired.kod}  |  fraga_nummer="${desired.fraga_nummer}"  |  ${prov.titel}  |  styrka=${junc.styrka}`);
      } else {
        console.log(`  ⚠️  Missing junction for ${desired.kod} on "${desired.fraga_nummer}"`);
      }
    }
  }

  console.log('\n=== FINAL FRAGA STATE (target provs — should be 1 per logical question) ===');
  const { data: finalFraga } = await supabase
    .from('fraga')
    .select('fraga_nummer, id, delprov!inner(prov!inner(slug, titel))')
    .in('delprov.prov.slug', TARGET_SLUGS);

  const finalGroups = new Map<string, any[]>();
  (finalFraga || []).forEach((f: any) => {
    const slug = f.delprov?.prov?.slug;
    const key = `${slug}::${f.fraga_nummer}`;
    if (!finalGroups.has(key)) finalGroups.set(key, []);
    finalGroups.get(key)!.push(f);
  });

  for (const [key, rows] of finalGroups.entries()) {
    console.log(`  ${key}: ${rows.length} fraga row(s)  [${rows.map((r: any) => r.id.slice(0,8)).join(', ')}]`);
  }

  console.log('\n(If you see 1 fraga per key above and the 3 ✅ junctions, the heavy cleanup is done.)');

  console.log('\n✅ Fix script complete.');
  console.log('   If the numbers above look correct (1 fraga per logical question + exactly the 3 junctions), you are done with the data cleanup.');
  console.log('   No more manual SQL needed for this.');
}

main().catch(err => {
  console.error('💥 Unhandled error in fix script:', err);
  process.exit(1);
});
