/**
 * Remove parser-junk GEO frågor and fix mis-parsed titles.
 *
 * Usage: npx tsx scripts/cleanup-geo-junk.ts [--dry-run]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const dryRun = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DELETE_IDS = [
  'f8188c46-8b62-4110-b5c4-de8cde122751', // geo-ak9-2014 B E C A junk
  '7ba3453b-1c71-4eae-93f7-239c7bf84b7c', // geo-ak9-2015 B E C A junk
  '299fa90a-4da6-4f14-9307-b876af7e4bf4', // geo-ak6-2015 B E C A junk
];

const FIX_B3 = {
  id: '047b9aa5-86a1-4f7b-b24e-5b85150ee0b3',
  from: /^A B C D:/,
  to: 'Översvämningar:',
};

async function main() {
  console.log(dryRun ? '🧪 Dry-run geo junk cleanup…' : '🧹 Cleaning GEO junk frågor…');

  for (const id of DELETE_IDS) {
    const { data: f } = await supabase.from('fraga').select('id, text').eq('id', id).maybeSingle();
    if (!f?.id) {
      console.warn(`  ⚠ Not found: ${id}`);
      continue;
    }
    console.log(`  ✗ delete ${id}: ${f.text?.slice(0, 50)}…`);
    if (!dryRun) {
      await supabase.from('fraga_kunskapsmal').delete().eq('fraga_id', id);
      await supabase.from('fraga').delete().eq('id', id);
    }
  }

  const { data: b3 } = await supabase.from('fraga').select('id, text').eq('id', FIX_B3.id).maybeSingle();
  if (b3?.text && FIX_B3.from.test(b3.text)) {
    const newText = b3.text.replace(FIX_B3.from, FIX_B3.to);
    console.log(`  ✎ fix ${FIX_B3.id}: A B C D → Översvämningar`);
    if (!dryRun) await supabase.from('fraga').update({ text: newText }).eq('id', FIX_B3.id);
  }

  console.log('\n✅ GEO junk cleanup done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});