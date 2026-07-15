/**
 * One-off migration: format raw prov.titel values in Supabase.
 *
 * Usage:
 *   npx tsx scripts/fix-prov-titles.ts
 *   npx tsx scripts/fix-prov-titles.ts --dry-run
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { formatProvTitel } from '../src/lib/format-titel';

const dryRun = process.argv.includes('--dry-run');

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  const { data, error } = await supabase
    .from('prov')
    .select('id, slug, titel, amne, ar, termin, typ, metadata');

  if (error) {
    console.error('Fetch error:', error.message);
    process.exit(1);
  }

  let updated = 0;
  let unchanged = 0;

  for (const p of data || []) {
    const rawSource =
      (p.metadata as { original_filename?: string } | null)?.original_filename?.replace(/\.pdf$/i, '') ||
      p.titel;

    const formatted = formatProvTitel({
      titel: rawSource,
      amne: p.amne,
      ar: p.ar,
      termin: p.termin,
      typ: p.typ,
    });

    if (formatted === p.titel) {
      unchanged++;
      continue;
    }

    console.log(`• ${p.slug}\n  ${p.titel}\n  → ${formatted}`);

    if (!dryRun) {
      const { error: upErr } = await supabase
        .from('prov')
        .update({ titel: formatted })
        .eq('id', p.id);

      if (upErr) {
        console.error('  ✗', upErr.message);
        continue;
      }
    }

    updated++;
  }

  console.log(
    dryRun
      ? `\nDry run: ${updated} would update, ${unchanged} unchanged (${data?.length} total)`
      : `\nDone: ${updated} updated, ${unchanged} unchanged (${data?.length} total)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});