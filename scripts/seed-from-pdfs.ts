/**
 * Extract real per-fråga content from local PDFs and seed Supabase.
 *
 * Usage:
 *   npx tsx scripts/seed-from-pdfs.ts
 *   npx tsx scripts/seed-from-pdfs.ts --dry-run
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';
import { formatProvTitel } from '../src/lib/format-titel';

const dryRun = process.argv.includes('--dry-run');

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const PROV_DIR = path.resolve('public/prov');

/** Manifest slug → actual filename on disk (handles bedomings vs bedomnings typo). */
const PDF_TARGETS = [
  {
    slug: 'c2720bf787',
    filename: '92024_bedomningsunderlag_b_maskinerna_ar_vara_vanner_text_och_fragor.pdf',
    parser: parseMaskinernaPdf,
  },
  {
    slug: '115162bb33',
    filename: '92025_bedomingsunderlag_c_skrivuppgift.pdf',
    parser: parseSkrivuppgiftPdf,
  },
  {
    slug: 'c93832c7f1',
    filename: '92024_bedomningsunderlag_b_inget trams_text_och_fragor.pdf',
    parser: parseIngetTramsPdf,
  },
] as const;

interface FragaSeed {
  fraga_nummer: string;
  typ: string;
  text: string;
  svarsalternativ_json?: { id: string; text: string }[] | null;
  vanliga_missforstand?: string;
  varfor_viktig?: string;
  max_poang?: number;
  kalla?: string;
}

async function extractPdfText(filename: string): Promise<string> {
  const filePath = path.join(PROV_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF not found: ${filePath}`);
  }
  const buf = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

function parseMaskinernaPdf(text: string): FragaSeed[] {
  const passage = text
    .split('Maskinerna är våra vänner')[0]
    .replace(/\s*-- \d+ of \d+ --\s*/g, '\n')
    .trim();

  return [
    {
      fraga_nummer: '6',
      typ: 'lang_svar',
      text: `Läs texten "Maskinerna är våra vänner" (Maria Gunther, DN 22.6.2014).\n\n6. Begreppen transcendens, singularitet och intelligensexplosion beskriver samma fenomen. Vilket? Motivera med exempel från texten.`,
      vanliga_missforstand:
        'Elever blandar ihop begreppen eller beskriver bara ett av dem. Andra citerar filmen Transcendence utan att koppla till frågans kärna.',
      varfor_viktig:
        'Tränar begreppsförståelse och att sammanfatta komplex sakprosa – centralt i läsning inför nationella prov.',
      max_poang: 2,
      kalla: 'Skolverket bedömningsunderlag 2024',
    },
    {
      fraga_nummer: '7',
      typ: 'flerval',
      text: `7. Vad testar ett Turingtest? Kryssa för rätt alternativ. Fler kryss än ett gör svaret ogiltigt.`,
      svarsalternativ_json: [
        { id: 'A', text: 'Om en robot kan verka mänsklig.' },
        { id: 'B', text: 'Om en robot kan vara smartare än en människa.' },
        { id: 'C', text: 'Om en robot kan vara mänsklig.' },
        { id: 'D', text: 'Om en robot kan avgöra om den är en människa.' },
      ],
      vanliga_missforstand:
        'Många väljer B (smartare) eller C (vara mänsklig) i stället för A (verka mänsklig). Elever missar att det handlar om imitation, inte överlägsenhet.',
      varfor_viktig:
        'Kopplar läsförståelse till vetenskapshistoria (Alan Turing) och källkritik kring AI – återkommande tema i NP-material.',
      max_poang: 2,
      kalla: 'Skolverket bedömningsunderlag 2024',
    },
    {
      fraga_nummer: '8',
      typ: 'flerval',
      text: `8. Christian Smith är positiv till utvecklingen av AI. Vilket av följande påståenden stämmer överens med hans motivering till det? Kryssa för rätt alternativ. Fler kryss än ett gör svaret ogiltigt.`,
      svarsalternativ_json: [
        { id: 'A', text: 'Människors hjärnor kommer alltid att vara överlägsna AI.' },
        { id: 'B', text: 'Civiliserade samhällen kommer att bli beroende av maskiner i framtiden.' },
        { id: 'C', text: 'Kärnvapen är betydligt farligare för mänskligheten än AI.' },
        { id: 'D', text: 'Vi kan hantera onda människor och då kan vi hantera onda maskiner.' },
      ],
      vanliga_missforstand:
        'Elever väljer B (beroende) utan att det är Smiths huvudargument. C lockar om man fokuserar på kärnvapen-passagen men missar jämförelsen med "naturlig intelligens".',
      varfor_viktig:
        'Kräver att eleven skiljer mellan olika ståndpunkter i samma text och identifierar rätt talares resonemang.',
      max_poang: 2,
      kalla: 'Skolverket bedömningsunderlag 2024',
    },
    {
      fraga_nummer: 'Läsningstext',
      typ: 'lasa',
      text: `Läsningstext (ur bedömningsunderlaget):\n\n${passage.slice(0, 1800)}…\n\n[Källa: Maria Gunther, Dagens Nyheter 22.6.2014. Full text i PDF.]`,
      vanliga_missforstand: 'Elever läser bara rubriken och svarar på uppgifterna utan att förstå hela textens struktur (hot vs hopp).',
      varfor_viktig: 'Grundtexten som alla uppgifter bygger på – viktig för kontextuell problemlösning i NP.',
      max_poang: 0,
      kalla: 'Skolverket bedömningsunderlag 2024',
    },
  ];
}

function parseIngetTramsPdf(text: string): FragaSeed[] {
  const excerpt = text.replace(/\s*-- \d+ of \d+ --\s*/g, '\n').trim().slice(0, 1600);

  return [
    {
      fraga_nummer: 'Läsningstext',
      typ: 'lasa',
      text: `Läsningstext (ur bedömningsunderlaget "Inget trams", Jan Guillou):\n\n${excerpt}…\n\n[Full text i PDF.]`,
      vanliga_missforstand: 'Elever fokuserar på finne/plotdetaljer och missar temat om identitet och tonårsliv.',
      varfor_viktig: 'Skönlitterär läsning med personligt perspektiv – central del av svenska åk 9.',
      max_poang: 0,
      kalla: 'Skolverket bedömningsunderlag 2024',
    },
    {
      fraga_nummer: '1',
      typ: 'lang_svar',
      text: 'Beskriv hur berättarens syn på sig själv förändras i början av texten. Använd minst två exempel från texten och förklara hur de stödjer din tolkning.',
      vanliga_missforstand: 'Elever sammanfattar handlingen utan att koppla till självbild/förändring, eller använder exempel utan förklaring.',
      varfor_viktig: 'Tränar textanalys och citatstödd argumentation – grundläggande för Delprov B läsning.',
      max_poang: 3,
      kalla: 'Skolverket bedömningsunderlag 2024',
    },
  ];
}

function parseSkrivuppgiftPdf(text: string): FragaSeed[] {
  const body = text.replace(/\s*-- \d+ of \d+ --\s*/g, '\n').trim();

  return [
    {
      fraga_nummer: 'Skrivuppgift C',
      typ: 'lang_svar',
      text: `${body}\n\nSkriv din krönika med rubriken "Sticka ut eller smälta in?". Resonera om varför man väljer att sticka ut eller vara en i mängden. Ge egna exempel.`,
      vanliga_missforstand:
        'Elever skriver berättande utan tydlig åsikt, eller glömmer krönikeformatet (personlig röst + resonemang + exempel). Andra kopierar från andra texter utan egna exempel.',
      varfor_viktig:
        'Delprov C testar skriftlig framställning i krönikeform – en av de vanligaste uppgiftstyperna i svenska åk 9.',
      max_poang: 12,
      kalla: 'Skolverket bedömningsunderlag 2025',
    },
  ];
}

async function getOrCreateDelprov(provId: string, beteckning = 'Bedömningsunderlag') {
  const { data: existing } = await supabase
    .from('delprov')
    .select('id')
    .eq('prov_id', provId)
    .eq('beteckning', beteckning)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from('delprov')
    .insert({
      prov_id: provId,
      beteckning,
      titel: beteckning,
      ordning: 1,
    })
    .select('id')
    .single();

  if (error) throw error;
  return created.id;
}

async function upsertFraga(delprovId: string, seed: FragaSeed) {
  const { data: existing } = await supabase
    .from('fraga')
    .select('id')
    .eq('delprov_id', delprovId)
    .eq('fraga_nummer', seed.fraga_nummer)
    .maybeSingle();

  const row = {
    delprov_id: delprovId,
    fraga_nummer: seed.fraga_nummer,
    typ: seed.typ,
    text: seed.text,
    svarsalternativ_json: seed.svarsalternativ_json ?? null,
    vanliga_missforstand: seed.vanliga_missforstand ?? null,
    varfor_viktig: seed.varfor_viktig ?? null,
    max_poang: seed.max_poang ?? 1,
    kalla: seed.kalla ?? 'Skolverket',
    human_reviewed: true,
  };

  if (dryRun) {
    console.log(`  [dry-run] ${seed.fraga_nummer}: ${seed.text.slice(0, 80)}…`);
    return existing?.id ?? 'dry-run-id';
  }

  if (existing?.id) {
    const { error } = await supabase.from('fraga').update(row).eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await supabase.from('fraga').insert(row).select('id').single();
  if (error) throw error;
  return data.id;
}

async function fixPdfUrls() {
  const { data: provs } = await supabase.from('prov').select('id, slug, pdf_url').not('pdf_url', 'is', null);
  let fixed = 0;
  for (const p of provs || []) {
    if (!p.pdf_url?.includes('/public/prov/')) continue;
    const newUrl = p.pdf_url.replace('/public/prov/', '/prov/');
    if (!dryRun) {
      await supabase.from('prov').update({ pdf_url: newUrl }).eq('id', p.id);
    }
    fixed++;
  }
  console.log(`  Fixed ${fixed} pdf_url paths (/public/prov/ → /prov/)`);
}

async function cleanupWrongFraga() {
  // c93832c7f1 is "Inget trams" (Svenska) – matematik-frågor landed here by mistake
  const wrongSlug = 'c93832c7f1';
  const { data: prov } = await supabase.from('prov').select('id').eq('slug', wrongSlug).single();
  if (!prov) return;

  const { data: dps } = await supabase.from('delprov').select('id').eq('prov_id', prov.id);
  const dpIds = (dps || []).map((d) => d.id);
  if (dpIds.length === 0) return;

  const { data: wrongFraga } = await supabase
    .from('fraga')
    .select('id, fraga_nummer')
    .in('delprov_id', dpIds)
    .in('fraga_nummer', ['1', '2a', '6', '7', '8', 'Läsningstext']);

  if (!wrongFraga?.length) return;

  console.log(`  Removing ${wrongFraga.length} misplaced fraga from ${wrongSlug} (Inget trams)`);
  if (!dryRun) {
    for (const f of wrongFraga) {
      await supabase.from('fraga_kunskapsmal').delete().eq('fraga_id', f.id);
      await supabase.from('community_forklaring').update({ fraga_id: null }).eq('fraga_id', f.id);
      await supabase.from('fraga').delete().eq('id', f.id);
    }
  }
}

async function seedJunction(j: {
  slug: string;
  fraga_nummer: string;
  kod: string;
  styrka: number;
  kommentar: string;
}) {
  const { data: prov } = await supabase.from('prov').select('id').eq('slug', j.slug).single();
  if (!prov) return;

  const { data: dps } = await supabase.from('delprov').select('id').eq('prov_id', prov.id);
  const dpIds = (dps || []).map((d) => d.id);
  if (dpIds.length === 0) return;

  const { data: fragor } = await supabase
    .from('fraga')
    .select('id')
    .in('delprov_id', dpIds)
    .eq('fraga_nummer', j.fraga_nummer)
    .order('id', { ascending: true })
    .limit(1);
  const fraga = fragor?.[0];

  const { data: km } = await supabase.from('kunskapsmal').select('id').eq('kod', j.kod).single();
  if (!fraga?.id || !km?.id) {
    console.warn(`  Skip junction ${j.kod} → ${j.slug}/${j.fraga_nummer}`);
    return;
  }

  if (!dryRun) {
    await supabase.from('fraga_kunskapsmal').upsert(
      {
        fraga_id: fraga.id,
        kunskapsmal_id: km.id,
        styrka: j.styrka,
        kommentar: j.kommentar,
        added_by: 'seed-from-pdfs',
      },
      { onConflict: 'fraga_id,kunskapsmal_id' }
    );
  }
  console.log(`  Junction: ${j.kod} → ${j.slug} fråga ${j.fraga_nummer}`);
}

async function seedJunctions(maSlug: string, svSlug: string) {
  const junctions = [
    { slug: maSlug, fraga_nummer: '7', kod: 'MA9.1.1', styrka: 0.8, kommentar: 'Tolkning av sakprosa och resonemang kring AI (läsning + problemlösning)' },
    { slug: maSlug, fraga_nummer: '8', kod: 'MA9.1.1', styrka: 0.75, kommentar: 'Identifiera ståndpunkt i text – strategival vid läsning' },
    { slug: svSlug, fraga_nummer: 'Skrivuppgift C', kod: 'SV9.2.1', styrka: 0.9, kommentar: 'Krönika – skriftlig framställning med personlig röst' },
    { slug: svSlug, fraga_nummer: 'Skrivuppgift C', kod: 'SV9.3.1', styrka: 0.7, kommentar: 'Kommunikation om identitet och grupptillhörighet' },
  ];

  for (const j of junctions) {
    const { data: prov } = await supabase.from('prov').select('id').eq('slug', j.slug).single();
    if (!prov) continue;

    const { data: dps } = await supabase.from('delprov').select('id').eq('prov_id', prov.id);
    const dpIds = (dps || []).map((d) => d.id);
    if (dpIds.length === 0) continue;

    const { data: fragor } = await supabase
      .from('fraga')
      .select('id')
      .in('delprov_id', dpIds)
      .eq('fraga_nummer', j.fraga_nummer)
      .order('id', { ascending: true })
      .limit(1);
    const fraga = fragor?.[0];

    const { data: km } = await supabase.from('kunskapsmal').select('id').eq('kod', j.kod).single();
    if (!fraga?.id || !km?.id) {
      console.warn(`  Skip junction ${j.kod} → ${j.slug}/${j.fraga_nummer}`);
      continue;
    }

    if (!dryRun) {
      await supabase.from('fraga_kunskapsmal').upsert(
        {
          fraga_id: fraga.id,
          kunskapsmal_id: km.id,
          styrka: j.styrka,
          kommentar: j.kommentar,
          added_by: 'seed-from-pdfs',
        },
        { onConflict: 'fraga_id,kunskapsmal_id' }
      );
    }
    console.log(`  Junction: ${j.kod} → ${j.slug} fråga ${j.fraga_nummer}`);
  }
}

async function seedMuntligExempel() {
  const slug = '52626660db';
  const filename = '92025_Delprov_A_muntlig_framstallning_exempeluppgift.pdf';
  const { data: prov } = await supabase.from('prov').select('id, titel, amne, ar').eq('slug', slug).single();
  if (!prov) return;

  let pdfText = '';
  try {
    pdfText = await extractPdfText(filename);
  } catch {
    pdfText = '';
  }

  const delprovId = await getOrCreateDelprov(prov.id, 'Delprov A');
  const seeds: FragaSeed[] = [
    {
      fraga_nummer: 'Förberedelse',
      typ: 'muntlig',
      text: pdfText
        ? `${pdfText.slice(0, 1800)}…\n\n[Förberedelse 30 min: sammanfattning, egna tankar, diskussionsfråga.]`
        : `Delprov A: muntlig framställning (${prov.ar || 2025}). Förberedelse 30 minuter.`,
      vanliga_missforstand: 'Elever skriver fullständigt manus i stället för stödord och tappar tid på detaljer.',
      varfor_viktig: 'Förberedelsemomentet är avgörande för struktur i presentation och diskussion.',
      max_poang: 0,
      kalla: 'Skolverket exempeluppgift 2025',
    },
    {
      fraga_nummer: 'Presentation 2–3 min',
      typ: 'muntlig',
      text: 'Presentera sammanfattning, egna tankar och diskussionsfrågan (2–3 minuter). Bedöms på tydlighet, struktur och anpassning.',
      vanliga_missforstand: 'Elever läser rakt av utan att anpassa till lyssnare eller hålla tidsramen.',
      varfor_viktig: 'Tränar muntlig produktion enligt SV9.3.1.',
      max_poang: 4,
      kalla: 'Skolverket exempeluppgift 2025',
    },
    {
      fraga_nummer: 'Diskussion 3–7 min',
      typ: 'muntlig',
      text: 'Leda och delta i diskussion (3–7 min): inled, säkerställ att alla kommer till tals, håll ämnet, sammanfatta.',
      vanliga_missforstand: 'Elever dominerar samtalet eller låter diskussionen spåra ur utan sammanfattning.',
      varfor_viktig: 'Interaktion och argumentation i samtal är central bedömningspunkt i Delprov A.',
      max_poang: 4,
      kalla: 'Skolverket exempeluppgift 2025',
    },
  ];

  if (!dryRun) {
    await supabase.from('prov').update({ pdf_url: `/prov/${filename}` }).eq('id', prov.id);
  }

  for (const seed of seeds) {
    await upsertFraga(delprovId, seed);
  }
  console.log(`  Seeded muntlig exempel for ${slug} (${seeds.length} moments)`);
}

async function main() {
  console.log(dryRun ? '📄 Dry-run seed from PDFs…' : '📄 Seeding from local PDFs…');

  await fixPdfUrls();
  await cleanupWrongFraga();

  for (const target of PDF_TARGETS) {
    console.log(`\n→ ${target.slug} (${target.filename})`);
    const text = await extractPdfText(target.filename);
    const seeds = target.parser(text);

    const { data: prov } = await supabase.from('prov').select('id, slug, titel, amne, ar, termin, typ, pdf_url').eq('slug', target.slug).single();
    if (!prov) {
      console.warn(`  Prov not found for slug ${target.slug}`);
      continue;
    }

    const pdfUrl = `/prov/${target.filename}`;
    if (!dryRun && prov.pdf_url !== pdfUrl) {
      await supabase.from('prov').update({ pdf_url: pdfUrl }).eq('id', prov.id);
    }

    const delprovId = await getOrCreateDelprov(prov.id, 'Bedömningsunderlag');
    for (const seed of seeds) {
      const id = await upsertFraga(delprovId, seed);
      console.log(`  ✓ ${seed.fraga_nummer} (${id})`);
    }

    const titel = formatProvTitel(prov);
    if (!dryRun && titel !== prov.titel) {
      await supabase.from('prov').update({ titel }).eq('id', prov.id);
    }
  }

  console.log('\n→ Junctions');
  await seedJunctions('c2720bf787', '115162bb33');
  await seedJunction({ slug: 'c93832c7f1', fraga_nummer: '1', kod: 'SV9.1.1', styrka: 0.85, kommentar: 'Textanalys skönlitterär berättartext' });
  await seedJunction({ slug: '52626660db', fraga_nummer: 'Presentation 2–3 min', kod: 'SV9.3.1', styrka: 0.9, kommentar: 'Muntlig framställning Delprov A' });

  console.log('\n→ Third prov (muntlig exempel, no local PDF)');
  await seedMuntligExempel();

  const { count } = await supabase.from('fraga').select('*', { count: 'exact', head: true });
  console.log(`\n✅ Done. Total fraga rows: ${count}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});