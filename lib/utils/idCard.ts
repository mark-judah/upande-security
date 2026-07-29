export type ParsedIdCard = {
  name?: string;
  idNumber?: string;
};

const ID_LABEL_RE = /\bID\s*(NO\.?|NUMBER)?\s*[:.]?\s*(\d{6,9})/i;
const STANDALONE_ID_RE = /\b\d{6,9}\b/g;
const DATE_LIKE_RE = /\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b/;
const NAME_LABEL_RE = /\b(FULL\s*NAMES?|SURNAME|NAMES?)\s*[:.]?\s*$/i;
const NAME_LINE_RE = /^[A-Z][A-Z '.-]{3,}$/;
const BOILERPLATE = [
  'REPUBLIC OF KENYA',
  'JAMHURI YA KENYA',
  'NATIONAL IDENTITY CARD',
  'NATIONAL ID',
  'IDENTITY CARD',
];

function isBoilerplate(line: string): boolean {
  const upper = line.trim().toUpperCase();
  return BOILERPLATE.some((b) => upper === b || upper.includes(b));
}

function extractIdNumber(lines: string[]): string | undefined {
  for (const line of lines) {
    const labelMatch = line.match(ID_LABEL_RE);
    if (labelMatch) return labelMatch[2];
  }

  for (let i = 0; i < lines.length; i++) {
    if (/\bID\b/i.test(lines[i]) && !DATE_LIKE_RE.test(lines[i])) {
      const next = lines[i + 1];
      const digits = next?.match(STANDALONE_ID_RE)?.[0];
      if (digits) return digits;
    }
  }

  const candidates: string[] = [];
  for (const line of lines) {
    if (DATE_LIKE_RE.test(line)) continue;
    const matches = line.match(STANDALONE_ID_RE);
    if (matches) candidates.push(...matches);
  }
  if (!candidates.length) return undefined;
  return candidates.reduce((longest, c) => (c.length > longest.length ? c : longest));
}

function extractName(lines: string[]): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    if (NAME_LABEL_RE.test(lines[i])) {
      const next = lines[i + 1]?.trim();
      if (next && NAME_LINE_RE.test(next) && !isBoilerplate(next)) return next;
    }
  }

  const candidates = lines
    .map((l) => l.trim())
    .filter((l) => NAME_LINE_RE.test(l) && !isBoilerplate(l) && l.split(/\s+/).length >= 2);
  if (!candidates.length) return undefined;
  return candidates.reduce((longest, c) => (c.length > longest.length ? c : longest));
}

/**
 * Best-effort extraction of a name and ID number from OCR'd ID card text.
 * Always leaves the result editable — never treated as ground truth.
 */
export function parseIdCardText(rawText: string): ParsedIdCard {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return {
    name: extractName(lines),
    idNumber: extractIdNumber(lines),
  };
}
