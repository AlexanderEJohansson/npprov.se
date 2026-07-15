import type { FragaSeed } from './eng-parse';
import { sanitizePdfText } from './sanitize-text';

/** Parse sparse svällbild-PDF text from Historia åk 9 */
export function parseHistoriaPdf(text: string): FragaSeed[] {
  const clean = sanitizePdfText(text).trim();
  const seeds: FragaSeed[] = [];

  const uppgift = clean.match(/Delprov\s+([A-Z]),?\s*uppgift\s+(\d+)\s+([^\n]+)/i);
  if (uppgift) {
    const [, delprov, num, title] = uppgift;
    const body = clean
      .replace(/#+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    seeds.push({
      fraga_nummer: num,
      typ: 'lang_svar',
      text: `Delprov ${delprov}, uppgift ${num}: ${title.trim()}. ${body.slice(0, 800)}`,
      vanliga_missforstand:
        'Elever beskriver diagrammet utan att koppla till historisk kontext eller tidsperiod.',
      varfor_viktig: `Historia åk 9 – ${title.trim()}. Kräver käll- och diagramtolkning.`,
      max_poang: 3,
      kalla: 'Skolverket (Historia åk 9)',
    });
  }

  return seeds;
}