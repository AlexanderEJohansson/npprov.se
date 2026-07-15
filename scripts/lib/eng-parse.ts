export interface FragaSeed {
  fraga_nummer: string;
  typ: string;
  text: string;
  vanliga_missforstand?: string;
  varfor_viktig?: string;
  max_poang?: number;
  kalla?: string;
}

import { sanitizePdfText } from './sanitize-text';

/** Parse Gula/Blå elevkort from Engelska åk 9 _ALLA.pdf text */
export function parseEngelskaElevkort(text: string): FragaSeed[] {
  const clean = sanitizePdfText(text);
  const seeds: FragaSeed[] = [];

  const gulaRe =
    /Gula elevkort,\s*(\d+)\s+av\s+12\s+([\s\S]*?)(?=Gula elevkort,\s*\d+|Blå elevkort,\s*1|$)/gi;
  for (const m of clean.matchAll(gulaRe)) {
    const cardNum = m[1];
    const body = m[2]
      .replace(/_Gulaelevkort[^\n]*/gi, '')
      .replace(/Gult kort/gi, '')
      .replace(/#3--#14[^\n]*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (body.length < 40) continue;
    seeds.push({
      fraga_nummer: `G-${cardNum}`,
      typ: 'muntlig',
      text: `Gult elevkort ${cardNum}/12 (uppgift 3–14): ${body}`,
      vanliga_missforstand:
        'Elever förbereder bara ett alternativ i paret eller glömmer att diskutera både för- och nackdelar på engelska.',
      varfor_viktig: 'Tränar muntlig interaktion och argumentation på engelska – centralt i NP Engelska åk 9.',
      max_poang: 2,
      kalla: 'Skolverket (Engelska åk 9, gula elevkort)',
    });
  }

  const blaRe =
    /Blå elevkort,\s*(\d+)\s+av\s+12\s+([\s\S]*?)(?=Blå elevkort,\s*\d+|$)/gi;
  for (const m of clean.matchAll(blaRe)) {
    const cardNum = m[1];
    const body = m[2]
      .replace(/_Blåelevkort[^\n]*/gi, '')
      .replace(/Blått kort/gi, '')
      .replace(/#8--#19[^\n]*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (body.length < 40) continue;
    seeds.push({
      fraga_nummer: `B-${cardNum}`,
      typ: 'muntlig',
      text: `Blått elevkort ${cardNum}/12 (uppgift 8–19): ${body}`,
      vanliga_missforstand:
        'Elever säger bara agree/disagree utan att motivera med exempel eller utveckla resonemanget.',
      varfor_viktig: 'Tränar att uttrycka och motivera åsikter på engelska – vanlig muntlig uppgiftstyp i NP.',
      max_poang: 2,
      kalla: 'Skolverket (Engelska åk 9, blå elevkort)',
    });
  }

  return seeds;
}