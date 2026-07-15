export interface ProvMeta {
  titel?: string | null;
  amne?: string | null;
  ar?: number | string | null;
  termin?: string | null;
  typ?: string | null;
}

const TYP_LABELS: Record<string, string> = {
  bedomningsunderlag: 'Bedömningsunderlag',
  bedomningsmall: 'Bedömningsmall',
  bedomningsanvisning: 'Bedömningsanvisning',
  delprov: 'Delprov',
  exempel: 'Exempeluppgift',
  lararinf: 'Lärarinformation',
  hela: 'Hela materialet',
  prov: 'Prov',
  ovrigt: 'Material',
};

const SUBJECT_FROM_CODE: Record<string, string> = {
  ma: 'Matematik',
  kp: 'Samhällskunskap',
  no: 'NO',
  kemi: 'Kemi',
  fysik: 'Fysik',
  biologi: 'Biologi',
};

/** Formaterar råa filnamn/manifest-titlar till läsbara svenska titlar. */
export function formatProvTitel(item: ProvMeta): string {
  const raw = (item.titel || '').trim().replace(/\.pdf$/i, '');
  if (!raw) return item.amne ? `${item.amne} ${item.ar || ''}`.trim() : 'Nationellt prov';

  if (!looksLikeRawFilename(raw)) {
    return dedupeRepeatedTitle(cleanupSpacing(raw));
  }

  const fromSkolverket = parseSkolverketStyle(raw, item);
  if (fromSkolverket) return fromSkolverket;

  const fromNpno = parseNpnoStyle(raw, item);
  if (fromNpno) return fromNpno;

  const fromMa = parseMaStyle(raw, item);
  if (fromMa) return fromMa;

  const fromEn = parseEnglishAkStyle(raw, item);
  if (fromEn) return fromEn;

  const fromUnderscore = parseUnderscoreStyle(raw, item);
  if (fromUnderscore) return fromUnderscore;

  return cleanupSpacing(raw.replace(/_/g, ' '));
}

export function formatProvTyp(typ?: string | null): string {
  if (!typ) return '';
  const key = typ.toLowerCase().replace(/\s+/g, '');
  return TYP_LABELS[key] || typ.charAt(0).toUpperCase() + typ.slice(1);
}

function looksLikeRawFilename(s: string): boolean {
  if (/\.pdf$/i.test(s)) return true;
  if ((s.match(/_/g) || []).length >= 2) return true;
  if (/^\d{4,5}_/i.test(s)) return true;
  if (/^npno\d/i.test(s)) return true;
  if (/^Ma\d[a-z]?-/i.test(s)) return true;
  if (/^Np \d.*Delprov.*Np \d/i.test(s)) return true;
  if (/np-\d-\d{4}-/i.test(s)) return true;
  return false;
}

function dedupeRepeatedTitle(s: string): string {
  const half = Math.floor(s.length / 2);
  if (s.length > 20) {
    const a = s.slice(0, half).trim();
    const b = s.slice(half).trim();
    if (b.startsWith(a.slice(0, Math.min(a.length, 12)))) return a;
  }
  const m = s.match(/^(.+?\s+Delprov\s+[A-G])\1*$/i);
  if (m) return m[1];
  const dup = s.match(/^(.{10,}?)(?:\s*\1)+$/);
  if (dup) return dup[1].trim();
  return s;
}

function cleanupSpacing(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function yearSuffix(ar?: number | string | null): string {
  if (!ar) return '';
  return ` (${ar})`;
}

function parseSkolverketStyle(raw: string, item: ProvMeta): string | null {
  const m = raw.match(/^(\d{4,5})_(.+)$/i);
  if (!m) return null;

  const yearDigits = m[1];
  const year = yearDigits.length === 5
    ? parseInt(yearDigits.slice(1), 10)
    : parseInt(yearDigits, 10);
  const body = m[2].replace(/_/g, ' ');

  const delprov = body.match(/delprov\s*([a-g]\d?)/i);
  const bed = body.match(/bedomnings(underlag|mall|anvisning)/i);
  const ex = body.match(/exempel/i);

  const parts: string[] = [];
  if (bed) parts.push(`Bedömnings${bed[1] === 'underlag' ? 'underlag' : bed[1]}`);
  else if (ex) parts.push('Exempeluppgift');
  else if (delprov) parts.push(`Delprov ${delprov[1].toUpperCase()}`);
  else if (item.typ) parts.push(formatProvTyp(item.typ));

  const rest = body
    .replace(/bedomnings(underlag|mall|anvisning)\s*[a-g]?\s*/gi, '')
    .replace(/delprov\s*[a-g]\d?\s*/gi, '')
    .replace(/exempel(uppgift)?\s*/gi, '')
    .replace(/text och fragor/gi, 'text och frågor')
    .replace(/muntlig framstallning/gi, 'muntlig framställning')
    .trim();

  if (rest && !parts.some(p => rest.toLowerCase().includes(p.toLowerCase().slice(0, 8)))) {
    const titled = titleCasePhrase(rest);
    if (titled) parts.push(titled);
  }

  const prefix = item.amne && !parts.join(' ').toLowerCase().includes((item.amne || '').toLowerCase().slice(0, 4))
    ? `${item.amne} – `
    : '';

  const y = item.ar || year;
  return `${prefix}${parts.join(' – ') || cleanupSpacing(body)}${yearSuffix(y)}`;
}

function parseNpnoStyle(raw: string, item: ProvMeta): string | null {
  const m = raw.match(/^npno(\d)-(\w{2})(\d{2})-(\w+)(?:-(.+))?$/i);
  if (!m) return null;

  const ak = m[1];
  const termCode = m[2];
  const yearShort = m[3];
  const subject = m[4];
  const rest = (m[5] || '').replace(/-/g, ' ');

  const term = termCode.toLowerCase() === 'vt' ? 'vårtermin' : termCode.toLowerCase() === 'ht' ? 'hösttermin' : termCode;
  const year = item.ar || (2000 + parseInt(yearShort, 10));
  const subjLabel = SUBJECT_FROM_CODE[subject.toLowerCase()] || titleCasePhrase(subject);

  const restFormatted = rest
    .replace(/delprov/gi, 'Delprov')
    .replace(/lararinf/gi, 'lärarinformation')
    .replace(/bedomningsanvisning/gi, 'bedömningsanvisning')
    .replace(/a(\d)/gi, 'A$1');

  return `NO åk ${ak}, ${subjLabel} – ${restFormatted}${yearSuffix(year)} (${term} ${year})`;
}

function parseMaStyle(raw: string, item: ProvMeta): string | null {
  const compact = raw.match(/^Ma(\d)([a-c]?)-(\w{2})(\d{2})$/i);
  if (compact) {
    const level = compact[1] + (compact[2] || '');
    const term = compact[3].toLowerCase() === 'vt' ? 'vårtermin' : 'hösttermin';
    const year = item.ar || (2000 + parseInt(compact[4], 10));
    return `Matematik ${level} – ${term} ${year}`;
  }

  const spaced = raw.match(/^Ma\s*(\d[a-c]?)\s*(VT|HT)\s*(\d{4})$/i);
  if (spaced) {
    const term = spaced[2].toUpperCase() === 'VT' ? 'vårtermin' : 'hösttermin';
    return `Matematik ${spaced[1]} – ${term} ${spaced[3]}`;
  }

  const np = raw.match(/^Np\s*(\d)\s*(\d{4})\s*Ma\s*Delprov\s*([A-G])/i);
  if (np) {
    return `Matematik åk ${np[1]} – Delprov ${np[3].toUpperCase()} (${np[2]})`;
  }

  return null;
}

function parseEnglishAkStyle(raw: string, item: ProvMeta): string | null {
  const normalized = raw.replace(/\u00e5/gi, 'å').replace(/\u00f6/gi, 'ö').replace(/\u00e4/gi, 'ä');

  const akFirst = normalized.match(/^Åk\s*(\d)\s*[_\s]*En[_\s]*(.*)$/i);
  if (akFirst) {
    const rest = formatEnglishTail(akFirst[2]);
    const y = item.ar ? ` (${item.ar})` : '';
    return `Engelska åk ${akFirst[1]} – ${rest}${y}`;
  }

  const enFirst = normalized.match(/^En[_\s]*ak\s*(\d)[_\s]+(.+)$/i);
  if (enFirst) {
    const rest = formatEnglishTail(enFirst[2]);
    const y = item.ar ? ` (${item.ar})` : '';
    return `Engelska åk ${enFirst[1]} – ${rest}${y}`;
  }

  return null;
}

function formatEnglishTail(tail: string): string {
  const cleaned = tail
    .replace(/[_-]+/g, ' ')
    .replace(/\bdp\s*([abc])\b/gi, (_, l) => `Delprov ${l.toUpperCase()}`)
    .replace(/\bdp([abc])\b/gi, (_, l) => `Delprov ${l.toUpperCase()}`)
    .replace(/\boverview\b/gi, 'Översikt')
    .replace(/\bovrigt\b/gi, 'Övrigt')
    .replace(/\s+/g, ' ')
    .trim();

  const special: Record<string, string> = {
    'spare time talk': 'Spare time talk',
    'my friend': 'My friend',
    'museum': 'Museum',
    'friends': 'Friends',
    'reports': 'Reports',
    'exempel pa elevtexter': 'Exempel på elevtexter',
    'exempel på elevtexter': 'Exempel på elevtexter',
    'oversikt': 'Översikt',
    'översikt': 'Översikt',
  };

  const lower = cleaned.toLowerCase();
  for (const [k, v] of Object.entries(special)) {
    if (lower === k || lower.startsWith(k)) return v;
  }

  return cleaned
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function parseUnderscoreStyle(raw: string, item: ProvMeta): string | null {
  if (!raw.includes('_')) return null;
  const parts = raw.split('_').map(p => titleCasePhrase(p.replace(/-/g, ' '))).filter(Boolean);
  const y = item.ar ? ` (${item.ar})` : '';
  const prefix = item.amne ? `${item.amne} – ` : '';
  return `${prefix}${parts.join(' – ')}${y}`;
}

function titleCasePhrase(s: string): string {
  const lower = s.toLowerCase().trim();
  if (!lower) return '';

  const special: Record<string, string> = {
    'inget trams': 'Inget trams',
    'maskinerna ar vara vanner': 'Maskinerna är våra vänner',
    'skrivuppgift': 'Skrivuppgift',
    'frågekort till tre hör ihop 3': 'Frågekort till tre hör ihop',
    'äp9': 'Ämnesprov åk 9',
    'äp6': 'Ämnesprov åk 6',
  };

  for (const [k, v] of Object.entries(special)) {
    if (lower.includes(k)) return v;
  }

  return lower.charAt(0).toUpperCase() + lower.slice(1);
}