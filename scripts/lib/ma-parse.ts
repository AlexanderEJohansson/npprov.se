export interface FragaSeed {
  fraga_nummer: string;
  typ: string;
  text: string;
  svarsalternativ_json?: { id: string; text: string }[] | null;
  korrekt_svar?: string | null;
  vanliga_missforstand?: string;
  varfor_viktig?: string;
  max_poang?: number;
  kalla?: string;
}

export function inferTyp(text: string): string {
  const t = text.toLowerCase();
  if (/sant\s+falskt|ringa in|kryss|sätt ett kryss|kryssa i/i.test(t)) return 'flerval';
  if (/diagrammen [a-f][–-][a-f]|vilket av diagrammen/i.test(t)) return 'flerval';
  if (/\b[a-f]:\s/.test(t) && /ringa in|stämmer alltid/i.test(t)) return 'flerval';
  if (/linjär modell.*exponentiell modell/i.test(t)) return 'flerval';
  if (/derivera|bestäm|lös|beräkna|visa att|skissa|förenkla|faktorisera/i.test(t)) return 'kort_svar';
  if (/förklara|motivera|resonera|redovisa/i.test(t)) return 'lang_svar';
  return 'kort_svar';
}

export function parsePoints(body: string): number {
  const m = body.match(/\((\d+)\/\d+\/\d+\)/);
  if (m) return Math.max(1, parseInt(m[1], 10));
  return 2;
}

export function truncateBeforeBedömning(text: string): string {
  const markers = [
    /Allmän information om bedöm/i,
    /BEDÖMNINGSANVISNINGAR/i,
    /Bedömningsanvisningar/i,
    /Instruktioner för sammanställning/i,
    /Kopieringsunderlag och webbmaterial/i,
  ];
  let cut = text.length;
  for (const re of markers) {
    const idx = text.search(re);
    if (idx > 200) cut = Math.min(cut, idx);
  }
  return text.slice(0, cut);
}

export function extractBedömningSection(text: string): string {
  const markers = [
    /Max \d+\/\d+\/\d+/,
    /BEDÖMNINGSANVISNINGAR/,
    /Bedömningsanvisningar/,
  ];
  for (const re of markers) {
    const idx = text.search(re);
    if (idx >= 0) return text.slice(idx);
  }
  return '';
}

export function cleanMaText(text: string, studentOnly = true): string {
  const base = studentOnly ? truncateBeforeBedömning(text) : text;
  return base
    .replace(/\s*-- \d+ of \d+ --\s*/g, '\n')
    .replace(/NpMa[^\n]*\n\d+\n/g, '\n')
    .replace(/Np3Ma\d+ Delprov [A-Z] \d+\n/g, '\n')
    .replace(/DIGITALA? VERKTYG ÄR INTE TILLÅTNA[^\n]*\n/gi, '\n')
    .replace(/© Skolverket[^\n]*/gi, '\n')
    .replace(/Prov som återanvänds[\s\S]*?2025-06-30\./gi, '\n')
    .replace(/Provet kommer inte att återanvändas[\s\S]*?\./gi, '\n')
    .replace(/Elevens namn och klass\/grupp[\s\S]*?Delprov [A-Z]\n/gi, '\n');
}

function extractLetteredAlternatives(body: string): { id: string; text: string }[] | null {
  if (!/\b[A-F]:\s/.test(body)) return null;

  const alts: { id: string; text: string }[] = [];
  const re = /\b([A-F]):\s*(.*?)(?=\s+[A-F]:|NpMa|$)/g;
  for (const m of body.matchAll(re)) {
    const text = m[2].replace(/\s+/g, ' ').trim();
    if (text.length > 3) alts.push({ id: m[1], text });
  }
  return alts.length >= 2 ? alts : null;
}

export function extractSvarsalternativ(body: string): { id: string; text: string }[] | null {
  const lettered = extractLetteredAlternatives(body);
  if (lettered) return lettered;

  if (/diagrammen [A-F][–-][A-F]|vilket av diagrammen/i.test(body)) {
    return 'ABCDEF'.split('').map((id) => ({ id, text: `Diagram ${id}` }));
  }

  if (/linjär modell/i.test(body) && /exponentiell modell/i.test(body)) {
    const situations = body.match(
      /(?:Antalet|Totalvikten|Volymen|Priset|Mängden|Hastigheten|Temperaturen)[^.]{10,}\./gi
    );
    if (situations && situations.length >= 2) {
      return situations.slice(0, 6).map((s, i) => ({
        id: String(i + 1),
        text: s.replace(/\s+/g, ' ').trim(),
      }));
    }
  }

  if (!/ringa in|kryssa i/i.test(body)) return null;

  const after = body.split(/ringa in ditt svar\.?/i)[1] || body;
  const chunk = after.replace(/\(\d+\/\d+\/\d+\)/g, '').trim();

  const formulas = chunk.match(/y\s*=\s*[^y]+?(?=\s*y\s*=|$)/gi);
  if (formulas && formulas.length >= 2) {
    return formulas.slice(0, 6).map((t, i) => ({
      id: String.fromCharCode(65 + i),
      text: t.replace(/\s+/g, ' ').trim(),
    }));
  }

  const lines = chunk
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 8 && !/^svar:/i.test(l));
  if (lines.length >= 2) {
    return lines.slice(0, 6).map((t, i) => ({
      id: String.fromCharCode(65 + i),
      text: t,
    }));
  }

  return null;
}

export function extractQuestionBodies(
  text: string,
  maxNum: number,
  minNum = 1
): { num: number; body: string }[] {
  const clean = cleanMaText(text);
  const re = /(?:^|\n)(\d+)\.\s+([\s\S]*?)(?=\n\d+\.\s+|$)/g;
  const seen = new Set<number>();
  const out: { num: number; body: string }[] = [];

  for (const m of clean.matchAll(re)) {
    const num = parseInt(m[1], 10);
    if (num < minNum || num > maxNum) continue;
    if (seen.has(num)) continue;

    let body = m[2]
      .trim()
      .replace(/\(\d+\/\d+\/\d+\)/g, '')
      .replace(/_{3,}/g, ' ___ ')
      .replace(/\s+/g, ' ')
      .trim();

    if (body.length < 25) continue;
    if (/^Namn:|Födelsedatum|Gymnasieprogram|Delprov [BCD]:/i.test(body)) continue;
    if (/^Uppgift \d+|bedömning|betygssättning|Kommunikationspoäng|Borttagen på grund/i.test(body)) continue;
    if (/^Max \d+\/\d+\/\d+/.test(body)) continue;

    seen.add(num);
    out.push({ num, body: body.slice(0, 1400) });
  }

  return out.sort((a, b) => a.num - b.num);
}

export function questionsToSeeds(
  questions: { num: number; body: string }[],
  context: { level: string; delprov: string }
): FragaSeed[] {
  return questions.map(({ num, body }) => {
    const alts = extractSvarsalternativ(body);
    const typ = alts ? 'flerval' : inferTyp(body);
    return {
      fraga_nummer: String(num),
      typ,
      text: body,
      svarsalternativ_json: alts,
      vanliga_missforstand:
        'Elever hoppar över motivering eller redovisar bara slutsvar utan mellanled – vanligt i nationella prov i matematik.',
      varfor_viktig: `${context.level} – ${context.delprov}.`,
      max_poang: parsePoints(body),
      kalla: 'Skolverket (nationellt prov matematik)',
    };
  });
}

function cleanFacit(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function parseGymFacitMap(section: string): Record<string, string> {
  const facit: Record<string, string> = {};
  const blocks = section.split(/(?=\n\d+\.\s+Max\s)/);

  for (const block of blocks) {
    const qMatch = block.match(/(?:^|\n)(\d+)\.\s+Max\s/);
    if (!qMatch) continue;
    const q = qMatch[1];
    const parts: string[] = [];

    for (const m of block.matchAll(/([a-c])\)\s+Korrekt svar\s*\(([^)]{1,200})\)/gi)) {
      parts.push(`${m[1]}: ${cleanFacit(m[2])}`);
    }

    if (parts.length === 0) {
      const m = block.match(/Korrekt svar\s*\(([^)]{1,200})\)/i);
      if (m) parts.push(cleanFacit(m[1]));
    }

    if (parts.length) facit[q] = parts.join('; ');
  }

  return facit;
}

/** Ma 1 tabellformat: "N. svar" följt av Korrekt svar / Lösning med korrekt svar */
function parseMa1TabellFacit(section: string): Record<string, string> {
  const facit: Record<string, string> = {};
  let currentQ: string | null = null;
  const lines = section.split('\n');

  const hasFacitMarker = (from: number) =>
    lines
      .slice(from, from + 4)
      .join(' ')
      .match(/korrekt svar|lösning med korrekt svar|godtagbart svar|resonemang som/i);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const main = line.match(/^(\d+)\.\s*(.*)$/);
    if (main) {
      currentQ = main[1];
      const rest = cleanFacit(main[2]);
      if (!rest || /borttagen/i.test(rest)) continue;

      if (hasFacitMarker(i + 1)) {
        facit[currentQ] = facit[currentQ] ? `${facit[currentQ]}; ${rest}` : rest;
      }
      continue;
    }

    const sub = line.match(/^([a-c])\)\s*(.*)$/i);
    if (sub && currentQ) {
      const rest = cleanFacit(sub[2]);
      if (rest && hasFacitMarker(i + 1)) {
        const part = `${sub[1]}: ${rest}`;
        facit[currentQ] = facit[currentQ] ? `${facit[currentQ]}; ${part}` : part;
      }
    }
  }

  return facit;
}

/** Parse facit map: fraga_nummer -> answer text */
export function parseFacitMap(text: string): Record<string, string> {
  const section = extractBedömningSection(text);
  if (!section) return {};

  const gym = parseGymFacitMap(section);
  if (Object.keys(gym).length > 0) return gym;

  return parseMa1TabellFacit(section);
}

/** Match facit text to flerval option id when possible */
export function matchFlervalAnswer(
  facit: string,
  alts: { id: string; text: string }[] | null | undefined
): string | null {
  if (!alts?.length) return facit;

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
  const f = norm(facit);

  if (/^[a-f](?:och[a-f])?$/i.test(facit.replace(/\s+/g, ''))) {
    const letters = [...facit.toUpperCase().matchAll(/\b[A-F]\b/g)].map((m) => m[0]);
    if (letters.length) return letters.join('; ');
  }

  const multi = [...facit.matchAll(/\b([A-F])\b/g)].map((m) => m[1]);
  if (multi.length > 1 && multi.every((l) => alts.some((a) => a.id === l))) {
    return multi.join('; ');
  }

  if (multi.length === 1 && alts.some((a) => a.id === multi[0])) {
    return multi[0];
  }

  for (const alt of alts) {
    if (norm(alt.text).includes(f) || f.includes(norm(alt.text).slice(0, 12))) {
      return alt.id;
    }
  }
  return facit;
}