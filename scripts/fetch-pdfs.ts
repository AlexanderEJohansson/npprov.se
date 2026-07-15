/**
 * Fetch/copy PDF and ZIP assets for npprov.se manifest entries.
 *
 * Sources (in order):
 *   1. ~/Desktop/Gamla NP
 *   2. ~/Desktop/npprov.se/public/prov
 *   3. ~/Desktop/npprov.se/data/raw/**
 *   4. Skolverket direct /download/ URLs from manifest.source_url
 *
 * Usage:
 *   npx tsx scripts/fetch-pdfs.ts
 *   npx tsx scripts/fetch-pdfs.ts --dry-run
 *   npx tsx scripts/fetch-pdfs.ts --download-only
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const dryRun = process.argv.includes('--dry-run');
const downloadOnly = process.argv.includes('--download-only');

const ROOT = path.resolve('.');
const DEST = path.join(ROOT, 'public/prov');
const MANIFEST_PATH = path.join(ROOT, 'src/data/manifest.json');

const SOURCE_DIRS = [
  path.join(process.env.HOME || '', 'Desktop/Gamla NP'),
  path.join(process.env.HOME || '', 'Desktop/npprov.se/public/prov'),
  path.join(process.env.HOME || '', 'Desktop/npprov.se/data/raw/gamla-np-original'),
  path.join(process.env.HOME || '', 'Desktop/npprov.se/data/raw/skolverket-examples'),
  path.join(process.env.HOME || '', 'Desktop/npprov.se/data/raw/umea-no9'),
  DEST,
];

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

interface ManifestItem {
  id: string;
  original_filename?: string;
  files?: { name?: string; local_path?: string | null; raw_path?: string | null }[];
  source_url?: string;
  type?: string;
}

function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.(pdf|zip)$/i, '')
    .replace(/bedomings/g, 'bedomnings')
    .replace(/[_\s.\-()]+/g, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function walkFiles(dir: string, out: Map<string, string>) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
      continue;
    }
    if (!/\.(pdf|zip|mp3)$/i.test(entry.name)) continue;
    const key = normalizeKey(entry.name);
    if (!out.has(key)) out.set(key, full);
  }
}

function findSource(filename: string, index: Map<string, string>): string | null {
  const key = normalizeKey(filename);
  if (index.has(key)) return index.get(key)!;

  // Fuzzy: manifest may say bedomnings, disk has bedomings
  const alt = filename.replace(/bedomnings/gi, 'bedomings');
  const altKey = normalizeKey(alt);
  if (index.has(altKey)) return index.get(altKey)!;

  return null;
}

async function downloadFile(url: string, destPath: string): Promise<boolean> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'npprov.se-astro/1.0 (educational archive)' },
    redirect: 'follow',
  });
  if (!res.ok) {
    console.warn(`  ✗ HTTP ${res.status} for ${url}`);
    return false;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200) {
    console.warn(`  ✗ Suspiciously small file (${buf.length} B) from ${url}`);
    return false;
  }
  if (!dryRun) fs.writeFileSync(destPath, buf);
  return true;
}

function copyFile(src: string, destPath: string) {
  if (!dryRun) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(src, destPath);
  }
}

async function updateDb(slug: string, filename: string, isZip: boolean) {
  if (!supabase || dryRun) return;
  const url = `/prov/${filename}`;
  const patch = isZip ? { zip_url: url } : { pdf_url: url };
  await supabase.from('prov').update(patch).eq('slug', slug);
}

async function main() {
  const manifest: ManifestItem[] = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  const index = new Map<string, string>();
  for (const dir of SOURCE_DIRS) walkFiles(dir, index);

  console.log(`Indexed ${index.size} local PDF/ZIP files from ${SOURCE_DIRS.length} source dirs`);
  fs.mkdirSync(DEST, { recursive: true });

  let copied = 0;
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of manifest) {
    const filename =
      item.original_filename || item.files?.[0]?.name || item.files?.[0]?.local_path?.split('/').pop();
    if (!filename) continue;

    const destPath = path.join(DEST, filename);
    const isZip = /\.zip$/i.test(filename);

    if (fs.existsSync(destPath)) {
      skipped++;
      await updateDb(item.id, filename, isZip);
      continue;
    }

    if (!downloadOnly) {
      const src = findSource(filename, index);
      if (src) {
        copyFile(src, destPath);
        copied++;
        console.log(`  📋 ${filename}`);
        await updateDb(item.id, filename, isZip);
        continue;
      }
    }

    const url = item.source_url || '';
    if (
      url.includes('skolverket.se/download/') ||
      url.includes('arkiv.edusci.umu.se/')
    ) {
      const ok = await downloadFile(url, destPath);
      if (ok) {
        downloaded++;
        console.log(`  ⬇️  ${filename}`);
        await updateDb(item.id, filename, isZip);
      } else {
        failed++;
      }
      continue;
    }

    failed++;
    if (failed <= 12) console.warn(`  ? No source: ${filename}`);
  }

  // Bonus: copy unmatched PDFs from Gamla NP that might be useful (not in manifest filename)
  const extraDir = path.join(process.env.HOME || '', 'Desktop/Gamla NP');
  if (fs.existsSync(extraDir) && !downloadOnly) {
    for (const f of fs.readdirSync(extraDir)) {
      if (!/\.pdf$/i.test(f)) continue;
      const destPath = path.join(DEST, f);
      if (fs.existsSync(destPath)) continue;
      copyFile(path.join(extraDir, f), destPath);
      console.log(`  ➕ extra: ${f}`);
      copied++;
    }
  }

  const destCount = fs.readdirSync(DEST).filter((f) => /\.(pdf|zip)$/i.test(f)).length;
  console.log('\n--- Summary ---');
  console.log(`Copied:     ${copied}`);
  console.log(`Downloaded: ${downloaded}`);
  console.log(`Skipped:    ${skipped} (already present)`);
  console.log(`Failed:     ${failed}`);
  console.log(`In public/prov now: ${destCount} files`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});