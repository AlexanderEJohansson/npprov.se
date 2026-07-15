import type { FragaSeed } from './eng-parse';
import { sanitizePdfText } from './sanitize-text';

function inferTyp(text: string): string {
  if (/kryssa|kryss i|alternativ|fler än ett kryss|sätt kryss/i.test(text)) return 'flerval';
  if (/resonera|motivera|förklara|utveckla|diskutera|utgå från/i.test(text)) return 'lang_svar';
  return 'kort_svar';
}

function geoMissforstand(text: string): string {
  if (/hållbar|konsumtion|jordklot/i.test(text)) {
    return 'Elever beskriver konsumtion utan att koppla till hållbar utveckling eller globala orsak-verkan-samband.';
  }
  if (/karta|befolkning|topografi|klimat/i.test(text)) {
    return 'Elever beskriver kartan ytligt utan att använda geografiska begrepp (t.ex. topografi, klimat, resurser).';
  }
  return 'Elever svarar utan att använda geografins begrepp och perspektiv (Människa–Natur, Individ–Samhälle) tydligt.';
}

const DELPROV_B_SECTIONS = [
  'HELA VÄRLDENS VARA',
  'VAD ÄR DET VERKLIGA PRISET',
  'FATTIGDOM OCH OHÄLSA',
  'MAT FRÅN HELA VÄRLDEN',
  'KARTAN SOM KÄLLA',
  'REGNSKOG OMVANDLAS TILL PLANTAGE',
  'KONSUMTION I VÄRLDENS LÄNDER',
  'BANGLADESH',
  'HAVSYTANS NIVÅ HÖJS',
  'ELEKTRONISKT AVFALL',
  'GRADNÄTET',
] as const;

/** Delprov B — thematic sections (UU 2016 PDF; "Uppgift N" at end is facit-grid only) */
export function parseGeografiDelprovB(text: string): FragaSeed[] {
  const clean = sanitizePdfText(text);
  const seeds: FragaSeed[] = [];
  const markerRe = new RegExp(
    `(${DELPROV_B_SECTIONS.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'g'
  );
  const hits = [...clean.matchAll(markerRe)];
  if (!hits.length) return seeds;

  for (let i = 0; i < hits.length; i++) {
    const title = hits[i][1];
    const start = (hits[i].index ?? 0) + title.length;
    const end = i + 1 < hits.length ? hits[i + 1].index! : clean.length;
    const body = clean
      .slice(start, end)
      .replace(/Uppgift\s+\d+[\s☐]*/gi, ' ')
      .replace(/!{2,}/g, ' ')
      .replace(/_{5,}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (body.length < 50) continue;
    if (seeds.at(-1)?.text.startsWith(`${title}:`)) continue;

    const num = String(seeds.length + 1);
    seeds.push({
      fraga_nummer: num,
      typ: inferTyp(body),
      text: `${title}: ${body.slice(0, 1400)}`,
      vanliga_missforstand: geoMissforstand(body),
      varfor_viktig: `Geografi åk 9 Delprov B – ${title}. Konsumtion, hållbar utveckling och globala samband.`,
      max_poang: inferTyp(body) === 'lang_svar' ? 4 : 2,
      kalla: 'Uppsala universitet (Geografi åk 9, 2016 Delprov B)',
    });
  }
  return seeds;
}

const DELPROV_A_SECTIONS = [
  'NORRA EUROPA',
  'BEFOLKNINGSFÖRDELNING',
  'GEOGRAFISKA BEGREPP',
  'Tidvatten',
  'FLICKORS SKOLGÅNG',
  'PRODUKTION AV ENERGI',
  'KLIMATDIAGRAM',
  'KLIMATFÖRÄNDRINGAR',
  'SÅRBARA STÄDER',
] as const;

/** Delprov A — thematic sections 1–9 (UU 2016 PDF) */
export function parseGeografiDelprovA(text: string): FragaSeed[] {
  const clean = sanitizePdfText(text);
  const seeds: FragaSeed[] = [];
  const markerRe = new RegExp(
    `(${DELPROV_A_SECTIONS.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'g'
  );
  const hits = [...clean.matchAll(markerRe)];
  if (!hits.length) return seeds;

  for (let i = 0; i < hits.length; i++) {
    const title = hits[i][1];
    const start = (hits[i].index ?? 0) + title.length;
    const end = i + 1 < hits.length ? hits[i + 1].index! : clean.length;
    const body = clean
      .slice(start, end)
      .replace(/!{2,}/g, ' ')
      .replace(/_{5,}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (body.length < 40) continue;

    const num = String(seeds.length + 1);
    seeds.push({
      fraga_nummer: num,
      typ: inferTyp(body),
      text: `${title}: ${body.slice(0, 1400)}`,
      vanliga_missforstand: geoMissforstand(body),
      varfor_viktig: `Geografi åk 9 Delprov A – ${title}. Begrepp, kartor och naturgeografi.`,
      max_poang: inferTyp(body) === 'lang_svar' ? 4 : 2,
      kalla: 'Uppsala universitet (Geografi åk 9, 2016 Delprov A)',
    });
  }
  return seeds;
}

/** Split a) b) c) sub-items into separate frågor when present */
export function expandLetteredSubQuestions(seed: FragaSeed, year: number, delprov: string): FragaSeed[] {
  const m = seed.text.match(/^([^:]+):\s*(.*)$/s);
  const title = m?.[1]?.trim() || seed.fraga_nummer;
  const body = m?.[2] || seed.text;
  const parts = [...body.matchAll(/\b([a-z])\)\s*([^]+?)(?=\s+[a-z]\)|$)/gi)];
  if (parts.length < 3) return [seed];

  return parts.map((p, i) => ({
    ...seed,
    fraga_nummer: `${seed.fraga_nummer}${p[1]}`,
    typ: /_______|siffra|para ihop/i.test(p[2]) ? 'kort_svar' : seed.typ,
    text: `${title} (${p[1]}): ${p[2].replace(/\s+/g, ' ').trim().slice(0, 1200)}`,
    kalla: `Uppsala universitet (Geografi åk 9, ${year} Delprov ${delprov})`,
  }));
}

/** 2013 Delprov A — UU PDF uses page numbers + thematic titles (not 2016-style ALL CAPS blocks) */
const GEO_2013_A_MARKERS: { num: string; title: string; re: RegExp }[] = [
  { num: '1', title: 'Var ligger platserna', re: /Var ligger platserna\?/ },
  { num: '2', title: 'Att visa befolkningsutveckling', re: /Att visa befolkningsutveckling/ },
  { num: '3', title: 'BNP per capita och medellivslängd', re: /BNP per capita och medellivslängd/ },
  {
    num: '4',
    title: 'BNP-diagram och resonemang',
    re: /Eleverna i en klass ska redovisa ett arbete om olika faktorer/,
  },
  {
    num: '5',
    title: 'Klimat',
    re: /5\s+a\)\s+Vad kallas de olika klimatzonerna/,
  },
  { num: '6', title: 'Klimatförändringar', re: /Klimatförändringar/ },
  { num: '7', title: 'Jordens gradnät', re: /Jordens gradnät/ },
  { num: '8', title: 'Naturresurser', re: /Naturresurser/ },
  {
    num: '9',
    title: 'Vindkraft',
    re: /9\s+Skriv ett svar till Maria|Nej till nya vindkraftverk!/,
  },
  { num: '10', title: 'Tillgång till rent vatten', re: /Tillgång till rent vatten/ },
  {
    num: '11',
    title: 'Vatten, hälsa och utveckling',
    re: /11\s+Förklara på vilka olika sätt tillgång till rent vatten/,
  },
  { num: '12', title: 'Nya produktionsmönster', re: /Nya produktionsmönster/ },
  {
    num: '13',
    title: 'Migration',
    re: /13\s+Vilka olika orsaker finns till att människor/,
  },
  { num: '14', title: 'Namn, läge och storlek', re: /Namn, läge och storlek/ },
];

export function parseGeografiDelprovA2013(text: string): FragaSeed[] {
  const clean = sanitizePdfText(text);
  const hits: { num: string; title: string; index: number }[] = [];

  for (const m of GEO_2013_A_MARKERS) {
    const match = m.re.exec(clean);
    if (!match) continue;
    const idx = match.index ?? 0;
    if (hits.some((h) => h.num === m.num)) continue;
    if (m.num === '3') {
      // Second "BNP per capita…" header belongs to uppgift 4, not 3
      const first = idx;
      const second = clean.indexOf('BNP per capita och medellivslängd', first + 1);
      if (second > 0 && second < (clean.search(/5\s+a\)\s+Vad kallas/) || clean.length)) {
        hits.push({ num: m.num, title: m.title, index: first });
        continue;
      }
    }
    hits.push({ num: m.num, title: m.title, index: idx });
  }

  hits.sort((a, b) => a.index - b.index);
  if (!hits.length) return [];

  const seeds: FragaSeed[] = [];
  for (let i = 0; i < hits.length; i++) {
    const { num, title, index } = hits[i];
    const end = i + 1 < hits.length ? hits[i + 1].index : clean.length;
    const body = clean
      .slice(index, end)
      .replace(/©\s*\d{4}[^]+?(?=\d|$)/gi, ' ')
      .replace(/!{2,}/g, ' ')
      .replace(/_{5,}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (body.length < 50) continue;

    const base: FragaSeed = {
      fraga_nummer: num,
      typ: inferTyp(body),
      text: `${title}: ${body.slice(0, 1400)}`,
      vanliga_missforstand: geoMissforstand(body),
      varfor_viktig: `Geografi åk 9 Delprov A (2013) – ${title}.`,
      max_poang: inferTyp(body) === 'lang_svar' ? 4 : 2,
      kalla: 'Uppsala universitet (Geografi åk 9, 2013 Delprov A)',
    };
    const expanded = expandLetteredSubQuestions(base, 2013, 'A');
    seeds.push(...expanded);
  }
  return seeds;
}

/** 2017 Delprov A — theme header + lettered map items */
export function parseGeografiDelprovA2017(text: string): FragaSeed[] {
  const clean = sanitizePdfText(text);
  const themeMatch = clean.match(/([A-ZÅÄÖ][A-ZÅÄÖ\s\-]{4,40})\s+3\s+1\s+Studera satellitbilden/i);
  const theme = themeMatch?.[1]?.trim() || 'Kartuppgift';
  const subStart = clean.search(/a\)\s+/i);
  if (subStart < 0) return parseGeografiNumberedSections(clean, 2017, 'A');

  const subBlock = clean.slice(subStart);
  const parts = [...subBlock.matchAll(/\b([a-z])\)\s*([^]+?)(?=\s+[a-z]\)|$)/gi)];
  if (parts.length < 3) return parseGeografiNumberedSections(clean, 2017, 'A');

  return parts.map((p) => ({
    fraga_nummer: p[1],
    typ: 'kort_svar',
    text: `${theme} (${p[1]}): ${p[2].replace(/_{3,}/g, '').replace(/\s+/g, ' ').trim()}`,
    vanliga_missforstand: geoMissforstand(p[2]),
    varfor_viktig: `Geografi åk 9 Delprov A (2017) – ${theme}, kartkunskap.`,
    max_poang: 1,
    kalla: 'Uppsala universitet (Geografi åk 9, 2017 Delprov A)',
  }));
}

export function geoKunskapsmalForText(text: string): string {
  if (/hållbar|konsumtion|jordklot|miljö/i.test(text)) return 'GEO9.1.1';
  if (/källa|undersök|värdera|data|diagram/i.test(text)) return 'GEO9.3.1';
  return 'GEO9.2.1';
}

const JUNK_THEMES = new Set([
  'JA NEJ', 'GEOGRAFI', 'E C A E C A E C A E C A', 'J F M A M J J A S O N D',
  'KVINNOR MÄN', 'SANT FALSKT', 'DELPROV', 'ÅRSKURS',
]);

/** Older UU PDFs (2013–2015) — numbered thematic blocks */
export function parseGeografiNumberedSections(text: string, year: number, delprov: 'A' | 'B'): FragaSeed[] {
  const clean = sanitizePdfText(text);
  const seeds: FragaSeed[] = [];
  const re = /(?:^|\s)(\d{1,2})\s+([A-ZÅÄÖ][A-Za-zåäöÅÄÖ\s\-–]{6,90}?)(?=\s+\d{1,2}\s+[A-ZÅÄÖ]|$)/g;
  const hits = [...clean.matchAll(re)];

  for (let i = 0; i < hits.length; i++) {
    const num = hits[i][1];
    const title = hits[i][2].replace(/\s+/g, ' ').trim();
    if (/årskurs|ämnetsprov|elevens namn/i.test(title)) continue;
    const start = (hits[i].index ?? 0) + hits[i][0].length;
    const end = i + 1 < hits.length ? hits[i + 1].index! : clean.length;
    const body = clean
      .slice(start, end)
      .replace(/Uppgift\s+\d+[\s☐]*/gi, ' ')
      .replace(/!{2,}/g, ' ')
      .replace(/_{5,}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (body.length < 60) continue;

    seeds.push({
      fraga_nummer: num,
      typ: inferTyp(body),
      text: `${title}: ${body.slice(0, 1400)}`,
      vanliga_missforstand: geoMissforstand(body),
      varfor_viktig: `Geografi åk 9 Delprov ${delprov} (${year}) – ${title}.`,
      max_poang: inferTyp(body) === 'lang_svar' ? 4 : 2,
      kalla: `Uppsala universitet (Geografi åk 9, ${year} Delprov ${delprov})`,
    });
  }
  return seeds;
}

/** Delprov B 2014+ — ALL CAPS thematic headers in PDF */
export function parseGeografiThemeSections(text: string, year: number): FragaSeed[] {
  const clean = sanitizePdfText(text);
  const seeds: FragaSeed[] = [];
  const re = /\n([A-ZÅÄÖ][A-ZÅÄÖ\s\-]{4,42})\n/g;
  const hits = [...clean.matchAll(re)].filter((h) => !JUNK_THEMES.has(h[1].trim()));

  for (let i = 0; i < hits.length; i++) {
    const title = hits[i][1].trim();
    const start = (hits[i].index ?? 0) + title.length;
    const end = i + 1 < hits.length ? hits[i + 1].index! : clean.length;
    const body = clean
      .slice(start, end)
      .replace(/Uppgift\s+\d+[\s☐]*/gi, ' ')
      .replace(/!{2,}/g, ' ')
      .replace(/_{5,}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (body.length < 80) continue;
    if (seeds.at(-1)?.text.startsWith(`${title}:`)) continue;

    const num = String(seeds.length + 1);
    seeds.push({
      fraga_nummer: num,
      typ: inferTyp(body),
      text: `${title}: ${body.slice(0, 1400)}`,
      vanliga_missforstand: geoMissforstand(body),
      varfor_viktig: `Geografi åk 9 Delprov B (${year}) – ${title}.`,
      max_poang: inferTyp(body) === 'lang_svar' ? 4 : 2,
      kalla: `Uppsala universitet (Geografi åk 9, ${year} Delprov B)`,
    });
  }
  return seeds;
}

export function resolveGeoParser(
  filename: string
): (text: string) => FragaSeed[] {
  const m = filename.match(/^geo-ak9-(\d{4})-delprov-([ab])\.pdf$/i);
  if (!m) return parseGeografiDelprovA;
  const year = Number(m[1]);
  const letter = m[2].toUpperCase() as 'A' | 'B';

  if (year === 2013 && letter === 'A') return parseGeografiDelprovA2013;
  if (year === 2017 && letter === 'A') return parseGeografiDelprovA2017;
  if (year === 2016) {
    return letter === 'A' ? parseGeografiDelprovA : parseGeografiDelprovB;
  }
  if (letter === 'B') {
    return (t) => {
      const themes = parseGeografiThemeSections(t, year);
      if (themes.length >= 2) return themes;
      if (year === 2016) return parseGeografiDelprovB(t);
      return parseGeografiNumberedSections(t, year, 'B');
    };
  }
  return (t) => {
    const sections = parseGeografiDelprovA(t);
    if (sections.length >= 2) return sections;
    const numbered = parseGeografiNumberedSections(t, year, 'A');
    return numbered.length ? numbered : sections;
  };
}