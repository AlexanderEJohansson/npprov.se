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

/** 2013 Delprov A — numbered blocks after header junk */
export function parseGeografiDelprovA2013(text: string): FragaSeed[] {
  const clean = sanitizePdfText(text);
  const seeds: FragaSeed[] = [];
  const re = /(?:^|\s)(\d{1,2})\s+([A-ZÅÄÖ][^\d]{8,80}?)(?=\s+\d{1,2}\s+[A-ZÅÄÖ]|$)/g;
  const hits = [...clean.matchAll(re)];

  for (let i = 0; i < hits.length; i++) {
    const num = hits[i][1];
    const title = hits[i][2].replace(/\s+/g, ' ').trim();
    if (/årskurs|ämnetsprov|elevens namn|sekretess/i.test(title)) continue;
    const start = (hits[i].index ?? 0) + hits[i][0].length;
    const end = i + 1 < hits.length ? hits[i + 1].index! : clean.length;
    const body = clean.slice(start, end).replace(/\s+/g, ' ').trim();
    if (body.length < 40) continue;

    const base: FragaSeed = {
      fraga_nummer: num,
      typ: inferTyp(body),
      text: `${title}: ${body.slice(0, 1400)}`,
      vanliga_missforstand: geoMissforstand(body),
      varfor_viktig: `Geografi åk 9 Delprov A (2013) – ${title}.`,
      max_poang: inferTyp(body) === 'lang_svar' ? 4 : 2,
      kalla: 'Uppsala universitet (Geografi åk 9, 2013 Delprov A)',
    };
    seeds.push(...expandLetteredSubQuestions(base, 2013, 'A'));
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