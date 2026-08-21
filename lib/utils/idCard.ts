export type ParsedIdCard = {
  name?: string;
  idNumber?: string;
};

// Kenyan ID cards print two distinct numbers: the "ID Number" (the 8-digit
// personal identifier — what we want) and a separate "Serial Number" (the
// physical card's own serial, printed near the barcode/QR — not what we
// want, but it's also a bare digit run so a naive "grab the longest number"
// fallback can pick it by mistake). Both the old-generation card and the
// new bilingual ("Maisha Namba") generation print both fields, just with
// Swahili labels added on the new one — kept in one label list so the same
// regexes work against either generation without needing to know which.
const ID_LABEL_RE = /\b(ID\s*(NO\.?|NUMBER)?|NAMBA\s*YA\s*KITAMBULISHO)\s*[:.]?\s*(\d{6,9})/i;
const SERIAL_LABEL_RE = /\b(SERIAL\s*(NO\.?|NUMBER)?|NAMBA\s*YA\s*MFUATANO)\b/i;
const STANDALONE_ID_RE = /\b\d{6,9}\b/g;
const DATE_LIKE_RE = /\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b/;
const NAME_LABEL_RE = /\b(FULL\s*NAMES?|SURNAME|NAMES?|MAJINA\s*KAMILI|JINA\s*LA\s*UKOO)\s*[:.]?\s*$/i;
const NAME_LINE_RE = /^[A-Z][A-Z '.-]{3,}$/;

// Card titles/headers — both generations, English + Swahili. Never a name,
// never an ID number.
const BOILERPLATE = [
  'REPUBLIC OF KENYA',
  'JAMHURI YA KENYA',
  'NATIONAL IDENTITY CARD',
  'NATIONAL ID',
  'IDENTITY CARD',
  'KITAMBULISHO CHA TAIFA', // new-generation bilingual title — was missing,
  // which let it fall through to the name-candidate path when no better
  // candidate was found.
  'HUDUMA NAMBA',
];

// Field labels that appear as their own OCR'd line on either generation.
// These must never be mistaken for the value they're labelling (e.g. "SEX"
// or "TAREHE YA KUZALIWA" are all-caps letter runs just like a real name is,
// so NAME_LINE_RE alone can't tell them apart).
const FIELD_LABEL_LINES = [
  'DATE OF BIRTH',
  'TAREHE YA KUZALIWA',
  'SEX',
  'JINSIA',
  'DISTRICT OF BIRTH',
  'WILAYA YA KUZALIWA',
  'PLACE OF BIRTH',
  'MAHALI PA KUZALIWA',
  'DATE OF ISSUE',
  'TAREHE YA KUTOLEWA',
  'PLACE OF ISSUE',
  'MAHALI PA KUTOLEWA',
  'HOLDER\'S SIGN',
  'SAHIHI YA MWENYEWE',
];

function isBoilerplate(line: string): boolean {
  const upper = line.trim().toUpperCase();
  return BOILERPLATE.some((b) => upper === b || upper.includes(b));
}

function isFieldLabelLine(line: string): boolean {
  const upper = line.trim().toUpperCase();
  return FIELD_LABEL_LINES.some((b) => upper === b || upper.includes(b));
}

function extractIdNumber(lines: string[]): string | undefined {
  // 1. Explicit "ID No" / "Namba ya Kitambulisho" label, digits on the same
  // line — highest confidence, and specific enough it can't collide with
  // the serial number label.
  for (const line of lines) {
    const labelMatch = line.match(ID_LABEL_RE);
    if (labelMatch) return labelMatch[3];
  }

  // Lines belonging to the Serial Number field — the label line itself and
  // the line right after it (where the digits usually sit) — are excluded
  // from every fallback below, so a longer/earlier serial number can't beat
  // out the real ID number.
  const excluded = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (SERIAL_LABEL_RE.test(lines[i])) {
      excluded.add(i);
      excluded.add(i + 1);
    }
  }

  // 2. "ID" appears on its own line with the digits on the next line.
  for (let i = 0; i < lines.length; i++) {
    if (excluded.has(i)) continue;
    if (/\bID\b/i.test(lines[i]) && !DATE_LIKE_RE.test(lines[i]) && !SERIAL_LABEL_RE.test(lines[i])) {
      const nextIdx = i + 1;
      if (excluded.has(nextIdx)) continue;
      const next = lines[nextIdx];
      const digits = next?.match(STANDALONE_ID_RE)?.[0];
      if (digits) return digits;
    }
  }

  // 3. Last resort — longest bare 6-9 digit run anywhere, but never from an
  // excluded (serial number) line.
  const candidates: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (excluded.has(i)) continue;
    const line = lines[i];
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
      if (next && NAME_LINE_RE.test(next) && !isBoilerplate(next) && !isFieldLabelLine(next)) {
        return next;
      }
    }
  }

  const candidates = lines
    .map((l) => l.trim())
    .filter(
      (l) =>
        NAME_LINE_RE.test(l) &&
        !isBoilerplate(l) &&
        !isFieldLabelLine(l) &&
        l.split(/\s+/).length >= 2,
    );
  if (!candidates.length) return undefined;
  return candidates.reduce((longest, c) => (c.length > longest.length ? c : longest));
}

/**
 * Best-effort extraction of a name and ID number from OCR'd ID card text.
 * Handles both the classic Kenyan ID and the newer bilingual (Maisha Namba)
 * generation via a shared English/Swahili label vocabulary — there's no
 * generation detection step because the same regexes cover both.
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
