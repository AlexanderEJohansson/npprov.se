/**
 * Seed script for npprov.se
 * 
 * Usage (after schema is pushed and env is set):
 *   npx tsx scripts/seed-from-manifest.ts
 * 
 * Or with ts-node if preferred.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { formatProvTitel } from '../src/lib/format-titel';

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function seed() {
  console.log('🌱 Starting seed from manifest...');

  const manifestPath = path.resolve('./src/data/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  let inserted = 0;
  let skipped = 0;

  for (const item of manifest) {
    const slug = item.id; // Use legacy id as slug for now

    // Check if exists
    const { data: existing } = await supabase
      .from('prov')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      skipped++;
      continue;
    }

    const provData = {
      slug,
      ar: item.year || 2020,
      termin: item.term || null,
      amne: mapSubject(item.subject),
      arskurs_kurs: mapLevel(item.level),
      typ: mapType(item.type),
      titel: formatProvTitel({
        titel: item.title,
        amne: mapSubject(item.subject),
        ar: item.year || 2020,
        termin: item.term || null,
        typ: mapType(item.type),
      }),
      kalla: item.source_note || 'Skolverket',
      kalla_url: item.source_url || 'https://www.skolverket.se/prov-och-bedomning/nationella-prov/bestall-nationella-prov/gamla-nationella-prov',
      pdf_url: item.files?.[0]?.local_path ? `/${item.files[0].local_path}` : null,
      human_reviewed: true,
      metadata: {
        original_filename: item.original_filename,
        legacy: true,
      },
    };

    const { error } = await supabase.from('prov').insert(provData);

    if (error) {
      console.error('Error inserting', item.title, error.message);
    } else {
      inserted++;
      if (inserted % 10 === 0) console.log(`Inserted ${inserted}...`);
    }
  }

  console.log(`✅ Seed complete. Inserted: ${inserted}, Skipped (already existed): ${skipped}`);
}

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
  return 'gy';
}

function mapType(t: string): string {
  if (t?.includes('bedom')) return 'bedomningsunderlag';
  if (t?.includes('exempel')) return 'exempel';
  if (t?.includes('delprov')) return 'delprov';
  if (t?.includes('hela')) return 'hela';
  return 'ovrigt';
}

seed().catch(console.error);
