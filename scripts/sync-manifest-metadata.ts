/**
 * Upsert prov metadata from manifest (insert missing, patch amne/arskurs/titel).
 *
 * Usage: npx tsx scripts/sync-manifest-metadata.ts
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { formatProvTitel } from '../src/lib/format-titel';

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const manifest = JSON.parse(fs.readFileSync('src/data/manifest.json', 'utf-8'));

function mapSubject(subj: string): string {
  const map: Record<string, string> = {
    Matematik: 'Matematik',
    'Svenska/SvA': 'Svenska',
    Engelska: 'Engelska',
    Biologi: 'Biologi',
    Fysik: 'Fysik',
    Kemi: 'Kemi',
    Historia: 'Historia',
    Religionskunskap: 'Religionskunskap',
    Samhällskunskap: 'Samhällskunskap',
    Geografi: 'Geografi',
  };
  return map[subj] || 'Matematik';
}

function mapLevel(level: string): 'ak3' | 'ak6' | 'ak9' | 'gy' {
  if (!level) return 'ak9';
  if (level.includes('ak3')) return 'ak3';
  if (level.includes('ak6')) return 'ak6';
  if (level.includes('ak9') || level.startsWith('9')) return 'ak9';
  if (level.includes('gy') || level.includes('gymnas')) return 'gy';
  return 'ak9';
}

function mapType(t: string): string {
  if (t?.includes('bedom')) return 'bedomningsunderlag';
  if (t?.includes('exempel')) return 'exempel';
  if (t?.includes('delprov')) return 'delprov';
  if (t?.includes('hela')) return 'hela';
  return 'ovrigt';
}

function assetUrl(item: { files?: { local_path?: string | null }[]; original_filename?: string }) {
  const local = item.files?.[0]?.local_path;
  if (local?.includes('public/prov/')) {
    const name = path.basename(local);
    return { pdf_url: `/prov/${name}` };
  }
  if (item.original_filename?.endsWith('.zip')) {
    return { zip_url: `/prov/${item.original_filename}` };
  }
  if (item.original_filename?.endsWith('.pdf')) {
    return { pdf_url: `/prov/${item.original_filename}` };
  }
  return {};
}

async function main() {
  let inserted = 0;
  let updated = 0;

  for (const item of manifest) {
    const amne = mapSubject(item.subject);
    const arskurs_kurs = mapLevel(item.level);
    const typ = mapType(item.type);
    const titel = formatProvTitel({
      titel: item.title,
      amne,
      ar: item.year || 2020,
      termin: item.term || null,
      typ,
    });

    const row = {
      slug: item.id,
      ar: item.year || 2020,
      termin: item.term || null,
      amne,
      arskurs_kurs,
      typ,
      titel,
      kalla: item.source_note || 'Skolverket',
      kalla_url:
        item.source_url ||
        'https://www.skolverket.se/prov-och-bedomning/nationella-prov/bestall-nationella-prov/gamla-nationella-prov',
      human_reviewed: true,
      metadata: {
        original_filename: item.original_filename,
        manifest_subject: item.subject,
      },
      ...assetUrl(item),
    };

    const { data: existing } = await supabase.from('prov').select('id, amne, titel').eq('slug', item.id).maybeSingle();

    if (!existing) {
      const { error } = await supabase.from('prov').insert(row);
      if (error) console.warn(`Insert ${item.id}:`, error.message);
      else inserted++;
      continue;
    }

    const { error } = await supabase
      .from('prov')
      .update({
        amne: row.amne,
        arskurs_kurs: row.arskurs_kurs,
        titel: row.titel,
        typ: row.typ,
        kalla: row.kalla,
        kalla_url: row.kalla_url,
        metadata: row.metadata,
        ...(row.pdf_url ? { pdf_url: row.pdf_url } : {}),
        ...(row.zip_url ? { zip_url: row.zip_url } : {}),
      })
      .eq('id', existing.id);

    if (error) console.warn(`Update ${item.id}:`, error.message);
    else updated++;
  }

  console.log(`✅ Sync done. Inserted ${inserted}, updated ${updated}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});