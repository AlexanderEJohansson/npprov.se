import 'dotenv/config';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const m = JSON.parse(fs.readFileSync('src/data/manifest.json', 'utf-8'));

async function main() {
  const { data: rows } = await sb.from('prov').select('id, slug, amne, arskurs, titel');
  const out: { slug: string; amne: string; file?: string }[] = [];
  for (const p of rows || []) {
    const { data: dps } = await sb.from('delprov').select('id').eq('prov_id', p.id);
    if (dps?.length) continue;
    const row = m.find((x: { id: string }) => x.id === p.slug);
    out.push({ slug: p.slug, amne: p.amne, file: row?.original_filename });
  }
  console.log(JSON.stringify(out, null, 2));
}

main();