/**
 * Reset human_reviewed on auto-seeded frågor (ärlighetsprincip).
 *
 * Usage: npx tsx scripts/fix-human-reviewed.ts [--dry-run]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const dryRun = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { count: before } = await supabase
    .from('fraga')
    .select('*', { count: 'exact', head: true })
    .eq('human_reviewed', true);

  console.log(dryRun ? '🧪 Dry-run human_reviewed reset…' : '🔧 Resetting human_reviewed…');
  console.log(`  Before: ${before} frågor med human_reviewed=true`);

  if (!dryRun) {
    const { error } = await supabase.from('fraga').update({ human_reviewed: false }).eq('human_reviewed', true);
    if (error) throw error;
  }

  const { count: after } = await supabase
    .from('fraga')
    .select('*', { count: 'exact', head: true })
    .eq('human_reviewed', true);

  console.log(`  After: ${after} (reset ~${(before || 0) - (after || 0)} rader)`);
  console.log('\n✅ human_reviewed reset done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});