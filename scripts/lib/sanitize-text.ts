/** Strip null bytes and other chars PostgreSQL TEXT rejects (e.g. PDF extract \\u0000). */
export function sanitizeDbText(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  return value
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizePdfText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/\s*-- \d+ of \d+ --\s*/g, '\n');
}