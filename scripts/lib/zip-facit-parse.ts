/** Parse bedömningskriterier / facit from Skolverket läraranvisning (docx) or PDF text. */

export function parseTexCodeFacit(text: string): Record<string, string> {
  const facit: Record<string, string> = {};
  const clean = text.replace(/\s+/g, ' ');

  // Ma-style: "B1. Max" or "Uppgift B1" + Korrekt svar
  for (const m of clean.matchAll(
    /\b([A-D]\d{1,2})\b[^]{0,120}?(?:Korrekt svar|Godtagbart svar|Rätta svar)\s*[:(]?\s*([^]+?)(?=\b[A-D]\d{1,2}\b|Bedömningsmatris|$)/gi
  )) {
    const body = m[2].trim().slice(0, 500);
    if (body.length > 8) facit[m[1].toUpperCase()] = body;
  }

  // Bedömningsmatris blocks per uppgiftskod
  for (const m of clean.matchAll(
    /\b([A-D]\d{1,2})\b[^]{0,80}?Bedömningsmatris[^]{0,40}?([^]+?)(?=\b[A-D]\d{1,2}\b|$)/gi
  )) {
    const body = m[2].trim().slice(0, 800);
    if (body.length > 20 && !facit[m[1].toUpperCase()]) {
      facit[m[1].toUpperCase()] = `Bedömningsmatris: ${body}`;
    }
  }

  // Generic numbered bedömning (Biologi etc.)
  for (const m of clean.matchAll(
    /(?:^|\s)(\d{1,2})[\.\)]\s+([^]{0,60}?)(?:Korrekt svar|Godtagbart svar|Exempel på svar)\s*[:(]?\s*([^]+?)(?=\s\d{1,2}[\.\)]|$)/gi
  )) {
    const body = m[3].trim().slice(0, 500);
    if (body.length > 8) facit[m[1]] = body;
  }

  return facit;
}

export function parseBedömningskriterierBlock(text: string): Record<string, string> {
  const facit: Record<string, string> = {};
  const clean = text.replace(/\s+/g, ' ');

  for (const m of clean.matchAll(
    /\b([A-D]\d{1,2})\b[^]{0,200}?Bedömningskriterier\s*[:(]?\s*([^]+?)(?=\b[A-D]\d{1,2}\b|$)/gi
  )) {
    const body = m[2].trim().slice(0, 900);
    if (body.length > 15) facit[m[1].toUpperCase()] = body;
  }

  // Sv/En: "Delprov B" section with E/C/A criteria
  for (const m of clean.matchAll(
    /Delprov\s+([A-D])[^]{0,120}?Bedömningskriterier\s*[:(]?\s*([^]+?)(?=Delprov\s+[A-D]|$)/gi
  )) {
    const body = m[2].trim().slice(0, 1200);
    if (body.length > 20) facit[`DELPROV_${m[1].toUpperCase()}`] = body;
  }

  return facit;
}

export function parseSvBedömningsunderlag(text: string): Record<string, string> {
  const facit: Record<string, string> = {};
  const blocks = text.split(/(?=Uppgift\s+\d+:)/i).filter((b) => /^Uppgift\s+\d/i.test(b));
  for (const block of blocks) {
    const head = block.match(/^Uppgift\s+(\d+):\s*/i);
    if (!head) continue;
    const body = block.replace(/^Uppgift\s+\d+:\s*/i, '').replace(/\s+/g, ' ').trim().slice(0, 900);
    if (body.length < 12) continue;
    facit[`B${head[1]}`] = body;
    facit[head[1]] = body;
  }
  return facit;
}

/** NO/Biologi UMU bedömningsanvisningar — godtagbart svar / korrekt svar per nummer */
export function parseNoBioFacit(text: string): Record<string, string> {
  const facit: Record<string, string> = {};

  for (const m of text.matchAll(
    /(\d{1,2})\.\s*[\r\n]+\s*Korrekt svar:\s*([\s\S]*?)(?=\d{1,2}\.\s*[\r\n]+|BEDÖMNINGSANVISNINGAR|$)/gi
  )) {
    const body = m[2].replace(/\s+/g, ' ').trim().slice(0, 500);
    if (body.length > 2) facit[m[1]] = body;
  }

  for (const m of text.matchAll(
    /(\d{1,2})\.\s*[\r\n]+([\s\S]*?)(?=\d{1,2}\.\s*[\r\n]+|BEDÖMNINGSANVISNINGAR|$)/g
  )) {
    if (facit[m[1]]) continue;
    const ex = m[2].match(/Exempel på elevsvar:\s*([\s\S]*?)(?=Exempel på elevsvar:|$)/i);
    if (ex?.[1]) {
      const body = ex[1].replace(/\s+/g, ' ').trim().slice(0, 500);
      if (body.length > 12) facit[m[1]] = `Exempel: ${body}`;
    }
  }

  return facit;
}

/** GU/SU översikt-PDF: bedömningskriterier per delprov */
export function parseDelprovOverviewFacit(text: string): Record<string, string> {
  const facit: Record<string, string> = {};
  const clean = text.replace(/\s+/g, ' ');

  for (const m of clean.matchAll(
    /Delprov\s+([A-D])[^]{0,80}?(?:Bedömningskriterier|Assessment criteria|Criteria)\s*[:\-]?\s*([^]+?)(?=Delprov\s+[A-D]|$)/gi
  )) {
    const body = m[2].trim().slice(0, 1200);
    if (body.length > 20) facit[`DELPROV_${m[1].toUpperCase()}`] = body;
  }

  if (!Object.keys(facit).length && clean.length > 80) {
    const letter = clean.match(/Delprov\s+([A-D])/i)?.[1];
    if (letter) facit[`DELPROV_${letter.toUpperCase()}`] = clean.slice(0, 1200);
  }

  return facit;
}

export function mergeFacitMaps(...maps: Record<string, string>[]): Record<string, string> {
  return Object.assign({}, ...maps);
}