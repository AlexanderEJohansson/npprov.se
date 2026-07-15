import { sanitizePdfText } from './sanitize-text';

export type GeoFacitEntry = {
  uppgift: number;
  facit: string;
  bedomningskriterier?: string;
};

/** Parse UU bedömningsanvisningar PDF text → uppgift number → facit/kriterier */
export function parseGeoFacitEntries(text: string): GeoFacitEntry[] {
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

    const aspektMatch = block.match(/Aspekter som ska bedömas\s*([\s\S]*?)(?=Progressionen|Belägg|Rätta svar|Uppgift|$)/i);
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

/** Map delprov-local fraga_nummer to global Uppgift id in bedömnings-PDF */
export function geoUppgiftId(
  year: number,
  delprov: 'A' | 'B',
  localNum: number,
  delprovBCount: number
): number {
  if (delprov === 'A') return localNum;
  // 2016: A has 9 sections → B starts at 18; scale for other years
  if (year === 2016) return localNum + 17;
  // Heuristic: B uppgifter follow A block in same PDF
  const { data: _ } = { data: null };
  void _;
  return localNum + Math.max(9, delprovBCount);
}

export function facitMapFromEntries(entries: GeoFacitEntry[]): Record<number, string> {
  const map: Record<number, string> = {};
  for (const e of entries) map[e.uppgift] = e.facit;
  return map;
}