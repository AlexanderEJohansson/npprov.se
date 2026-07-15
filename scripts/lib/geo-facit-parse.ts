import { sanitizePdfText } from './sanitize-text';

export type GeoFacitEntry = {
  uppgift: number;
  facit: string;
  bedomningskriterier?: string;
  label?: string;
};

/** Delprov A: standalone letter → global uppgift (2017 kartuppgift) */
const GEO_A_LETTER_UPPGIFT: Record<number, Record<string, number>> = {
  2017: {
    a: 13,
    b: 13,
    c: 13,
    d: 13,
    e: 13,
    f: 1,
    g: 1,
    h: 1,
    i: 1,
    j: 1,
    k: 1,
    l: 1,
    m: 1,
  },
};

function isTocUppgiftBlock(block: string): boolean {
  return /\.\.\.|^Uppgift\s+\d+\s*\.{3,}/m.test(block.slice(0, 120));
}

function trimModernFacit(raw: string): string {
  let facit = raw
    .replace(/^\.?\s*(?:Progressionen|Belägg för)[^.]*\.?\s*/i, '')
    .replace(/^\d+-\d+\s+rätta\s+svar\.?\s*/gi, '')
    .replace(/^Rätta\s+svar\s*/i, '')
    .replace(/^Korrekta\s+svar\s*/i, '')
    .replace(/^\s*Max\s+antal[^.]*\.?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  const end = facit.search(
    /\bMax\s+antal\s+(?:rätta|rätta\s+svar|korrekta)\b|\bBEDÖMNINGSANVISNINGAR\b|\bUppgift\s+\d{1,2}\b/i
  );
  if (end > 8) facit = facit.slice(0, end).trim();

  return facit;
}

function isUsefulFacit(facit: string): boolean {
  if (facit.length < 8) return false;
  if (/^Bedömningskriterier:\s*•\s*I vilken utsträckning/i.test(facit) && facit.length < 120) {
    return false;
  }
  if (/^\.?\s*Progressionen/i.test(facit) && !/\ba\)|\bX\b|Sant\s+Falskt|Stämmer/i.test(facit)) {
    return false;
  }
  return true;
}

function bedomningsGuidanceFromBlock(block: string): string | undefined {
  const parts: string[] = [];
  const aspekt = block.match(
    /Bedömningsaspekter[^]*?(?=Belägg för|Exempel på|Progression|Rätta svar|Uppgift\s+\d|$)/i
  );
  if (aspekt?.[0]) parts.push(aspekt[0].replace(/\s+/g, ' ').trim().slice(0, 600));

  const relevant = block.match(
    /Relevanta\s+(?:konsekvenser|argument|förklaringar)[^.]*\.([\s\S]*?)(?=Uppgift\s+\d|Bedömnings|$)/i
  );
  if (relevant?.[0]) parts.push(relevant[0].replace(/\s+/g, ' ').trim().slice(0, 600));

  if (!parts.length) return undefined;
  return parts.join(' ').slice(0, 900);
}

/** Parse UU bedömningsanvisningar 2016+ (Rätta svar + Uppgift N Formulering) */
function parseGeoFacitModern(text: string): GeoFacitEntry[] {
  const clean = sanitizePdfText(text);
  const byUppgift = new Map<number, GeoFacitEntry>();
  const blocks = clean.split(/(?=Uppgift\s+\d{1,2}\b)/i).filter((b) => /Uppgift\s+\d/i.test(b));

  for (const block of blocks) {
    if (isTocUppgiftBlock(block)) continue;

    const head = block.match(/^Uppgift\s+(\d{1,2})\b/i);
    if (!head) continue;
    const uppgift = Number(head[1]);
    if (byUppgift.has(uppgift)) continue;

    const rattaIdx = block.search(/Rätta svar/i);
    let facit = '';
    if (rattaIdx >= 0) {
      facit = trimModernFacit(block.slice(rattaIdx));
    }

    const bedomningskriterier = bedomningsGuidanceFromBlock(block);
    const value = isUsefulFacit(facit) ? facit : bedomningskriterier;
    if (!value || value.length < 8) continue;

    byUppgift.set(uppgift, {
      uppgift,
      facit: isUsefulFacit(facit) ? facit : `Bedömningskriterier: ${bedomningskriterier?.slice(0, 700)}`,
      bedomningskriterier,
    });
  }

  return [...byUppgift.values()].sort((a, b) => a.uppgift - b.uppgift);
}

const KORREKTA_SVAR_HEADING = /(?:^|[\n\r])Korrekta svar(?!\s+på\b)/gi;

function isKorrektaSvarHeading(clean: string, index: number): boolean {
  const charBefore = clean[index - 1];
  if (charBefore && !/[\n\r\t]/.test(charBefore)) return false;

  const after = clean.slice(index + 'Korrekta svar'.length, index + 'Korrekta svar'.length + 8);
  if (/^\s+på\b/i.test(after)) return false;

  const lineStart = clean.lastIndexOf('\n', index - 1) + 1;
  const linePrefix = clean.slice(lineStart, index);
  if (/\d[\d\-\s]*korrekta\s+svar\s*$/i.test(linePrefix)) return false;
  if (/antal\s+korrekta\s+svar\s*$/i.test(linePrefix)) return false;
  if (/rubriken\s+[""]\s*$/i.test(linePrefix)) return false;
  return true;
}

function trimLegacyFacitBody(raw: string): { body: string; uppgiftInline: number | null } {
  const uppgiftMatch = raw.match(/^\s*uppgift\s+(\d{1,2})\b/i);
  const uppgiftInline = uppgiftMatch ? Number(uppgiftMatch[1]) : null;

  let body = raw
    .replace(/^Korrekta svar\s*/i, '')
    .replace(/^\s*uppgift\s+[a-z\d]+\s*/i, '')
    .replace(/^\s*Max antal korrekta svar:\s*\d+\s*/i, '')
    .trim();

  const end = body.search(
    /\bMax antal korrekta svar:\s*\d+|\bBedömningsanvisningar\b|\b\d{1,2}\s+Uppgiftsformulering\b|\n\d{1,2}\s*\n[A-ZÅÄÖ]|\b\d{1,2}\s+[A-ZÅÄÖ][A-ZÅÄÖa-zåäö\s\-]{4,}\s+Uppgift\s+\d|\bUppgift\s+\d{1,2}\s+[A-ZÅÄÖ]/i
  );
  if (end > 12) body = body.slice(0, end);
  body = body.replace(/\s+/g, ' ').trim();

  return { body: body.trim(), uppgiftInline };
}

function isLegacyFacitJunk(body: string): boolean {
  if (body.length < 8) return true;
  if (
    /progressionen|resultatrapport|Belägg för|bedöms enligt|på båda uppgifterna|finns på sida|struktur:|Beskrivning av progressionen/i.test(
      body
    )
  ) {
    return true;
  }
  if (/^[\d\-\s.:]+(?:korrekta svar)?$/i.test(body)) return true;
  if (/^:\s*\d{1,2}\s+[A-ZÅÄÖ]{3,}/.test(body)) return true;
  if (/^Huvudrubrik\b/i.test(body)) return true;
  if (/^Exempel på elevsvar\b/i.test(body)) return true;
  if (
    /Av elevens förklaring ska det framgå/i.test(body) &&
    !/(?:=\s*\d|Bild\s+\d|\bX\b|Sant\s+Falskt)/i.test(body)
  ) {
    return true;
  }

  return !/(?:\d{1,2}\b|=\s*[A-Z]|Bild\s+\d|\ba\)|\bX\b|ja\s+nej|Sant\s+Falskt|Stämmer)/i.test(
    body
  );
}

function resolveLegacyUppgift(
  clean: string,
  index: number,
  uppgiftInline: number | null,
  fallback: number
): number {
  if (uppgiftInline) return uppgiftInline;

  const tail = clean.slice(index, index + 1200);
  const nextForm = tail.match(/\b(\d{1,2})\s+Uppgiftsformulering\b/i);
  if (nextForm) return Math.max(1, Number(nextForm[1]) - 1);

  const context = clean.slice(Math.max(0, index - 500), index);
  const localForm = [...context.matchAll(/\b(\d{1,2})\s+Uppgiftsformulering\b/gi)].pop();
  if (localForm) return Number(localForm[1]);

  return fallback;
}

/** Parse UU bedömningsanvisningar 2013–2015 (Korrekta svar + temarubriker) */
function parseGeoFacitLegacy(text: string): GeoFacitEntry[] {
  const clean = sanitizePdfText(text);
  const byUppgift = new Map<number, GeoFacitEntry>();
  let seq = 0;

  const re = new RegExp(KORREKTA_SVAR_HEADING);
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean)) !== null) {
    const idx = m.index + (m[0].startsWith('\n') ? 1 : 0);
    if (!isKorrektaSvarHeading(clean, idx)) continue;

    const rawBody = clean.slice(idx + 'Korrekta svar'.length, idx + 5000);
    const { body, uppgiftInline } = trimLegacyFacitBody(rawBody);
    if (isLegacyFacitJunk(body)) continue;

    seq++;
    const uppgift = resolveLegacyUppgift(clean, idx, uppgiftInline, seq);
    const prev = byUppgift.get(uppgift);
    if (!prev || body.length > prev.facit.length) {
      byUppgift.set(uppgift, { uppgift, facit: body.slice(0, 4000) });
    }
  }

  const inlineBlocks = clean.split(/(?=Uppgift\s+\d{1,2}(?:\s|\.))/i);
  for (const block of inlineBlocks) {
    const head = block.match(/^Uppgift\s+(\d{1,2})[a-z]?\s*[\.\s]/i);
    if (!head) continue;
    const uppgift = Number(head[1]);
    if (byUppgift.has(uppgift)) continue;

    const inlineFacit = block.match(
      /\b([a-z]\)\s*[A-ZÅÄÖa-zåäö][^]+?)(?=Uppgiften prövar|Bedömningsaspekt|Uppgift\s+\d|$)/i
    );
    if (!inlineFacit) continue;

    const lines = [...inlineFacit[1].matchAll(/\b[a-z]\)\s*[^a-z\)]+/gi)]
      .map((x) => x[0].replace(/\s+/g, ' ').trim())
      .filter((l) => l.length > 4);

    if (lines.length < 2) continue;
    byUppgift.set(uppgift, {
      uppgift,
      facit: lines.join(' | ').slice(0, 4000),
    });
  }

  return [...byUppgift.values()].sort((a, b) => a.uppgift - b.uppgift);
}

export function parseGeoFacitEntries(text: string): GeoFacitEntry[] {
  const modern = parseGeoFacitModern(text);
  const legacy = parseGeoFacitLegacy(text);
  const merged = new Map<number, GeoFacitEntry>();

  for (const e of [...legacy, ...modern]) {
    const prev = merged.get(e.uppgift);
    const score = (x: GeoFacitEntry) =>
      (/\ba\)|\bX\b|Sant\s+Falskt|Stämmer|= \d/i.test(x.facit) ? 2 : 0) + x.facit.length / 1000;
    if (!prev || score(e) > score(prev)) merged.set(e.uppgift, e);
  }

  return [...merged.values()].sort((a, b) => a.uppgift - b.uppgift);
}

/** Per-year offset: first Uppgift id in Delprov B bedömnings-PDF */
export const GEO_B_UPPGIFT_OFFSET: Record<number, number> = {
  2013: 14,
  2014: 17,
  2015: 18,
  2016: 18,
  2017: 12,
  2018: 14,
};

export function geoUppgiftId(
  year: number,
  delprov: 'A' | 'B',
  localNum: string | number,
  aCount: number
): number | null {
  const raw = String(localNum).trim();
  const sub = raw.match(/^(\d+)([a-z])$/i);
  if (sub) {
    const parent = Number(sub[1]);
    if (delprov === 'A') return parent;
    const offset = GEO_B_UPPGIFT_OFFSET[year] ?? aCount + 1;
    return parent + offset - 1;
  }

  const letterOnly = raw.match(/^([a-z])$/i);
  if (letterOnly && delprov === 'A') {
    return GEO_A_LETTER_UPPGIFT[year]?.[letterOnly[1].toLowerCase()] ?? null;
  }

  const local = Number.parseInt(raw, 10);
  if (!Number.isFinite(local)) return null;
  if (delprov === 'A') return local;
  const offset = GEO_B_UPPGIFT_OFFSET[year] ?? aCount + 1;
  return local + offset - 1;
}

/** Pull a) b) c) answer from combined facit block */
export function extractSubFacit(facit: string, fragaNummer: string): string | null {
  const sub = String(fragaNummer).match(/^(\d+)?([a-z])$/i);
  if (!sub?.[2]) return facit;

  const letter = sub[2].toLowerCase();
  const patterns = [
    new RegExp(`\\b${letter}\\)\\s*[^a-z\\)]{4,}`, 'i'),
    new RegExp(`\\b${letter}\\s*\\)\\s*[^a-z\\)]{4,}`, 'i'),
  ];

  for (const re of patterns) {
    const m = facit.match(re);
    if (m) return m[0].replace(/\s+/g, ' ').trim();
  }

  return facit;
}

function normalizeTheme(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-ZÅÄÖ0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function guidanceSearchTerms(fragaText: string): string[] {
  const title = fragaText.match(/^([^:(]+)/)?.[1]?.trim() || '';
  const terms: string[] = [];

  if (title.length > 5 && !/^(?:[A-Z]\s*){1,4}$/.test(title)) {
    terms.push(title);
    terms.push(title.split(/\s+/).slice(0, 2).join(' '));
  }
  if (/BNP|diagrammet|Maja|Ali/i.test(fragaText)) {
    terms.push('BNP per capita', 'diagrammet', 'Maja kan använda');
  }
  if (/Ganges|floder/i.test(fragaText)) terms.push('Ganges', 'tätbefolkade');
  if (/slaveri/i.test(fragaText)) terms.push('slaveri', 'Uppgift 30');
  if (/Klimatdiagram|monsun/i.test(fragaText)) terms.push('Klimatdiagram', 'monsun');

  return [...new Set(terms)];
}

/** Open-ended questions: extract progression/bedömningsaspekter from raw bedömnings-PDF */
export function guidanceFromBedText(bedText: string, fragaText: string): string | null {
  const clean = sanitizePdfText(bedText);
  const patterns = guidanceSearchTerms(fragaText)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter((p) => p.length > 4);

  for (const pat of patterns) {
    const idx = clean.search(new RegExp(pat, 'i'));
    if (idx < 0) continue;

    const slice = clean.slice(Math.max(0, idx - 250), idx + 2200);
    if (/☐|resultatrapport/i.test(slice.slice(0, 180))) continue;

    const prog = slice.match(
      /(?:Belägg för|Beskrivning av progressionen)[^]+?(?=Uppgift\s+\d|Delprov [AB]\b|$)/i
    );
    if (prog?.[0] && prog[0].length > 50) {
      return `Bedömningskriterier: ${prog[0].replace(/\s+/g, ' ').slice(0, 900)}`;
    }

    const guidance = bedomningsGuidanceFromBlock(slice);
    if (guidance) return `Bedömningskriterier: ${guidance}`;
  }

  return null;
}

/** Match facit by question title when numeric mapping fails (e.g. 2014 B Nordostpassagen → uppgift 27) */
export function facitForFraga(
  fragaText: string,
  fragaNummer: string,
  year: number,
  delprov: 'A' | 'B',
  aCount: number,
  facitMap: Record<number, string>,
  entries: GeoFacitEntry[],
  bedText?: string
): string | null {
  const uppgiftId = geoUppgiftId(year, delprov, fragaNummer, aCount);
  if (uppgiftId && facitMap[uppgiftId]) {
    return extractSubFacit(facitMap[uppgiftId], fragaNummer);
  }

  const title = fragaText.match(/^([^:(]+)/)?.[1]?.trim();
  if (!title || title.length < 5) {
    return bedText ? guidanceFromBedText(bedText, fragaText) : null;
  }
  const theme = normalizeTheme(title);

  for (const e of entries) {
    const facitNorm = normalizeTheme(e.facit);
    if (facitNorm.includes(theme) || theme.includes(normalizeTheme(e.facit.slice(0, 30)))) {
      return extractSubFacit(e.facit, fragaNummer);
    }
    if (/NORDOST/i.test(theme) && /NORDOSTPASSAGEN/i.test(e.facit)) {
      return extractSubFacit(e.facit, fragaNummer);
    }
  }

  if (bedText) {
    const guidance = guidanceFromBedText(bedText, fragaText);
    if (guidance) return guidance;
  }

  return null;
}

export function facitMapFromEntries(entries: GeoFacitEntry[]): Record<number, string> {
  const map: Record<number, string> = {};
  for (const e of entries) map[e.uppgift] = e.facit;
  return map;
}