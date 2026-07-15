import { sanitizePdfText } from './sanitize-text';

export type GeoFacitEntry = {
  uppgift: number;
  facit: string;
  bedomningskriterier?: string;
  label?: string;
};

/** Parse UU bedömningsanvisningar 2016+ (Rätta svar + Uppgift N Formulering) */
function parseGeoFacitModern(text: string): GeoFacitEntry[] {
  const clean = sanitizePdfText(text);
  const entries: GeoFacitEntry[] = [];
  const blocks = clean.split(/(?=Uppgift\s+\d{1,2}\b)/i).filter((b) => /Uppgift\s+\d/i.test(b));

  for (const block of blocks) {
    const head = block.match(/^Uppgift\s+(\d{1,2})\b/i);
    if (!head) continue;
    const uppgift = Number(head[1]);

    const rattaIdx = block.search(/Rätta svar/i);
    let facit = '';
    if (rattaIdx >= 0) {
      const slice = block.slice(rattaIdx);
      const end = slice.search(/Max antal|BEFOLKNINGS|^[A-ZÅÄÖ][A-ZÅÄÖ\s\-]{4,}/m);
      facit = slice
        .slice(0, end > 0 ? end : 1200)
        .replace(/Rätta svar\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    const aspektMatch = block.match(
      /Aspekter som ska bedömas\s*([\s\S]*?)(?=Progressionen|Belägg|Rätta svar|Uppgift|$)/i
    );
    const bedomningskriterier = aspektMatch?.[1]?.replace(/\s+/g, ' ').trim();

    const value = facit || bedomningskriterier;
    if (!value || value.length < 8) continue;

    entries.push({
      uppgift,
      facit: facit || `Bedömningskriterier: ${bedomningskriterier?.slice(0, 500)}`,
      bedomningskriterier,
    });
  }

  return entries;
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

  // Inline facit utan rubrik "Korrekta svar" (t.ex. a) Tullunion b) Ekvatorn)
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
  if (modern.length >= 3) return modern;
  const legacy = parseGeoFacitLegacy(text);
  return legacy.length > modern.length ? legacy : modern;
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
  localNum: number,
  aCount: number
): number | null {
  const local = Number.parseInt(String(localNum), 10);
  if (!Number.isFinite(local)) {
    const letter = String(localNum).match(/^(\d+)?([a-z])$/i);
    if (letter?.[2]) return null;
    return null;
  }
  if (delprov === 'A') return local;
  const offset = GEO_B_UPPGIFT_OFFSET[year] ?? aCount + 1;
  return local + offset - 1;
}

export function facitMapFromEntries(entries: GeoFacitEntry[]): Record<number, string> {
  const map: Record<number, string> = {};
  for (const e of entries) map[e.uppgift] = e.facit;
  return map;
}