/**
 * Tier-2 seed: prov with local PDF/MP3 but no TEX parser — metadata delprov + summary fråga.
 *
 * Usage: npx tsx scripts/seed-tier2-pdf.ts [--dry-run]
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { sanitizeDbText } from './lib/sanitize-text';

const dryRun = process.argv.includes('--dry-run');
const PROV_DIR = path.resolve('public/prov');
const MANIFEST = JSON.parse(fs.readFileSync('src/data/manifest.json', 'utf-8')) as {
  id: string;
  subject: string;
  title?: string;
  type?: string;
  original_filename?: string;
}[];

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function inferDelprovLabel(item: { type?: string; title?: string; original_filename?: string }): string {
  const t = `${item.type || ''} ${item.title || ''} ${item.original_filename || ''}`.toLowerCase();
  if (t.includes('delprov a')) return 'Delprov A';
  if (t.includes('delprov b')) return 'Delprov B';
  if (t.includes('delprov c')) return 'Delprov C';
  if (t.includes('bedöm') || t.includes('bedom')) return 'Bedömningsunderlag';
  if (t.includes('exempel')) return 'Exempelmaterial';
  if (t.includes('matris')) return 'Bedömningsmatris';
  if (t.includes('larar') || t.includes('lärar')) return 'Lärarinformation';
  return 'Huvuddel';
}

async function main() {
  console.log(dryRun ? '🧪 Dry-run tier-2 PDF seed…' : '📄 Seeding tier-2 PDF/metadata prov…');
  let total = 0;

  const { data: provs } = await supabase.from('prov').select('id, slug, amne, titel');
  const provBySlug = new Map((provs || []).map((p) => [p.slug, p]));

  for (const item of MANIFEST) {
    const file = item.original_filename;
    if (!file) continue;
    const localPath = path.join(PROV_DIR, file);
    if (!fs.existsSync(localPath)) continue;

    const prov = provBySlug.get(item.id);
    if (!prov) continue;

    const { count: dpCount } = await supabase
      .from('delprov')
      .select('*', { count: 'exact', head: true })
      .eq('prov_id', prov.id);
    if (dpCount) continue;

    const beteckning = inferDelprovLabel(item);
    const ext = path.extname(file).toLowerCase();
    const assetUrl = `/prov/${file}`;

    if (!dryRun) {
      const patch =
        ext === '.pdf' ? { pdf_url: assetUrl } : ext === '.zip' ? { zip_url: assetUrl } : {};
      if (Object.keys(patch).length) {
        await supabase.from('prov').update(patch).eq('id', prov.id);
      }
    }

    let delprovId: string | undefined;
    if (!dryRun) {
      const { data: dp, error } = await supabase
        .from('delprov')
        .insert({
          prov_id: prov.id,
          beteckning,
          titel: beteckning,
          ordning: 1,
          pdf_url: ext === '.pdf' ? assetUrl : null,
        })
        .select('id')
        .single();
      if (error) throw error;
      delprovId = dp.id;
    }

    const seed = {
      fraga_nummer: '1',
      typ: ext === '.mp3' ? 'lyssning' : 'ovrigt',
      text: `${item.subject} – ${item.title || file}. Arkiverat ${ext === '.pdf' ? 'PDF' : ext === '.zip' ? 'ZIP' : 'media'}-material från Skolverket. Per-fråga-struktur kräver manuell eller framtida parser — se originalfil för fullständigt innehåll.`,
      vanliga_missforstand: 'Elever/lärare förväxlar bedömningsunderlag med själva elevprovet.',
      varfor_viktig: `${item.subject}: ${item.title || file}. Officiellt material med provenance på npprov.se.`,
      max_poang: 1,
      kalla: `Skolverket (${file})`,
    };

    if (!dryRun && delprovId) {
      const { error } = await supabase.from('fraga').insert({
        delprov_id: delprovId,
        fraga_nummer: seed.fraga_nummer,
        typ: seed.typ,
        text: sanitizeDbText(seed.text),
        vanliga_missforstand: sanitizeDbText(seed.vanliga_missforstand),
        varfor_viktig: sanitizeDbText(seed.varfor_viktig),
        max_poang: seed.max_poang,
        kalla: sanitizeDbText(seed.kalla),
        human_reviewed: true,
      });
      if (error) throw error;
    }

    console.log(`  ${item.id}: ${file} → ${beteckning}`);
    total++;
  }

  const { count } = await supabase.from('fraga').select('*', { count: 'exact', head: true });
  console.log(`\n✅ Tier-2 PDF seed done. Touched ~${total} prov. Total fraga in DB: ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});