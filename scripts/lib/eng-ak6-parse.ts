import type { FragaSeed } from './eng-parse';
import { sanitizePdfText } from './sanitize-text';

/** Muntliga elevkort åk 6 (What do you like best? blocks) */
export function parseEngelskaAk6Elevkort(text: string): FragaSeed[] {
  const clean = sanitizePdfText(text);
  const seeds: FragaSeed[] = [];
  const blocks = clean.split(/(?=What do you like best\?)/i).filter((b) => b.length > 60);

  blocks.forEach((block, i) => {
    const topic = block.match(/•\s*([^\n•]+)/)?.[1]?.trim();
    const body = block.replace(/\s+/g, ' ').trim();
    if (body.length < 50) return;
    seeds.push({
      fraga_nummer: `K-${i + 1}`,
      typ: 'muntlig',
      text: `Speaking card ${i + 1}${topic ? ` (${topic})` : ''}: ${body.slice(0, 1200)}`,
      vanliga_missforstand:
        'Elever svarar kort utan att motivera med "Explain why!" eller ställa följdfrågor till kompisen.',
      varfor_viktig: 'Muntlig interaktion åk 6 – preferenser, frågor och jämförelse med vuxna.',
      max_poang: 2,
      kalla: 'Skolverket (Engelska åk 6, speaking elevkort)',
    });
  });

  return seeds;
}

/** Skrivuppgift / discussion PDF (En_ak6_*.pdf) */
export function parseEngelskaAk6Writing(text: string, topic: string): FragaSeed[] {
  const clean = sanitizePdfText(text).replace(/\s+/g, ' ').trim();
  if (clean.length < 80) return [];
  return [
    {
      fraga_nummer: '1',
      typ: 'lang_svar',
      text: `${topic}: ${clean.slice(0, 1500)}`,
      vanliga_missforstand:
        'Elever skriver för kort eller blandar svenska/engelska utan tydlig struktur (who/why/examples).',
      varfor_viktig: `Engelska åk 6 – skrivuppgift: ${topic}.`,
      max_poang: 3,
      kalla: `Skolverket (Engelska åk 6, ${topic})`,
    },
  ];
}

/** Gap-fill reading (Living_statues, Teen_biking) */
export function parseEngelskaAk6GapFill(text: string, title: string): FragaSeed[] {
  const clean = sanitizePdfText(text);
  const seeds: FragaSeed[] = [];
  const gapRe = /(\d+)\.\s*A\s+.+?(?=\d+\.\s*A\s+|$)/gis;
  for (const m of clean.matchAll(gapRe)) {
    const num = m[0].match(/^(\d+)/)?.[1];
    if (!num) continue;
    const body = m[0].replace(/\s+/g, ' ').trim();
    seeds.push({
      fraga_nummer: num,
      typ: 'flerval',
      text: `${title} – gap ${num}: ${body.slice(0, 600)}`,
      vanliga_missforstand: 'Elever väljer ord som grammatiskt passar lokalt men inte i hela meningen.',
      varfor_viktig: `${title} – läsförståelse med lucktext (åk 6).`,
      max_poang: 1,
      kalla: `Skolverket (Engelska åk 6, ${title})`,
    });
  }
  if (!seeds.length && clean.length > 100) {
    seeds.push({
      fraga_nummer: '1',
      typ: 'lasa',
      text: `${title}: ${clean.replace(/\s+/g, ' ').slice(0, 1500)}`,
      varfor_viktig: `${title} – läsförståelse åk 6.`,
      kalla: `Skolverket (Engelska åk 6, ${title})`,
    });
  }
  return seeds;
}