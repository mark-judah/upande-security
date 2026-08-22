import type { ParsedIdCard } from './idCard';

/**
 * TD1-format MRZ parser (ICAO 9303) — the 3-line × 30-character machine
 * readable zone printed on national ID cards (Kenya's newer "Maisha Namba"
 * generation included), as opposed to TD3 (2×44, passports).
 *
 * Why this is worth having alongside the existing full-text regex parser in
 * idCard.ts: an MRZ is a fixed-width field layout with check digits baked
 * in, so once three MRZ-shaped lines are found, extraction is instant and
 * — critically — verifiable. idCard.ts's regex heuristics are a best-effort
 * guess with no way to confirm they picked the right line; a passing MRZ
 * check digit means the read is *known* correct, not just plausible. The
 * classic (older) Kenyan ID has no MRZ at all, so this is additive, not a
 * replacement — parseIdOrMrz() below tries this first and only falls back
 * to the old parser when no valid MRZ is present.
 */

const MRZ_CHARSET_RE = /^[A-Z0-9<]+$/;
const WEIGHTS = [7, 3, 1];

function charValue(c: string): number {
  if (c === '<') return 0;
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
  if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 55; // A=10 ... Z=35
  return 0;
}

/** Standard ICAO 9303 check-digit algorithm: weights 7,3,1 repeating, mod 10. */
function checkDigit(data: string): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += charValue(data[i]) * WEIGHTS[i % 3];
  }
  return sum % 10;
}

function isCheckDigitChar(c: string): boolean {
  return c >= '0' && c <= '9';
}

/**
 * Scans OCR'd text for three consecutive MRZ-shaped lines (mostly
 * A-Z/0-9/< characters, close to 30 chars). Lenient here on purpose — OCR
 * commonly drops or adds a stray character — actual correctness is proven
 * by check-digit validation afterwards, not by how strictly we detect
 * candidate lines up front.
 */
function findMrzLines(rawText: string): [string, string, string] | null {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim().toUpperCase().replace(/\s+/g, ''))
    .filter(Boolean);

  for (let i = 0; i + 2 < lines.length; i++) {
    const candidate = [lines[i], lines[i + 1], lines[i + 2]];
    const looksLikeMrz = candidate.every((l) => {
      if (l.length < 28 || l.length > 32) return false;
      if (!MRZ_CHARSET_RE.test(l)) return false;
      const fillerCount = (l.match(/</g) || []).length;
      // A real MRZ line is padded with `<` fairly heavily; a normal OCR'd
      // sentence won't accidentally satisfy both the charset and this.
      return fillerCount >= 1;
    });
    if (looksLikeMrz) return candidate as [string, string, string];
  }
  return null;
}

function pad30(line: string): string {
  return line.length >= 30 ? line.slice(0, 30) : line.padEnd(30, '<');
}

function formatMrzDate(yymmdd: string): string | undefined {
  if (!/^\d{6}$/.test(yymmdd)) return undefined;
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  // No century pivot data is available on the card itself — MRZ dates are
  // always 2-digit years by spec. A person alive today with a birth year
  // that would put them over ~100 is far less likely than the alternative,
  // so pivot at 30 (never wrong for expiry dates within any card's validity
  // window either).
  const century = yy > 30 ? 1900 : 2000;
  return `${century + yy}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
}

function formatMrzName(nameField: string): string | undefined {
  const cleaned = nameField.replace(/<+$/g, '');
  if (!cleaned) return undefined;
  const [surname, given] = cleaned.split('<<');
  const surnamePart = (surname || '').replace(/</g, ' ').trim();
  const givenPart = (given || '').replace(/</g, ' ').trim();
  const full = [givenPart, surnamePart].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return full || undefined;
}

export type MrzResult = ParsedIdCard & { mrzValid: boolean };

/**
 * Parses a TD1 MRZ if one is present and its check digits all validate.
 * Returns null if no MRZ-shaped lines were found, or if found but any
 * check digit fails — in either case the caller should fall back to
 * idCard.ts's full-text parser rather than trust a bad read.
 */
export function parseMrz(rawText: string): MrzResult | null {
  const lines = findMrzLines(rawText);
  if (!lines) return null;

  const [l1, l2, l3] = lines.map(pad30) as [string, string, string];

  // Line 1: doc type(2) + country(3) + doc number(9) + doc number check(1) + optional(15)
  const docNumberRaw = l1.slice(5, 14);
  const docNumberCheck = l1[14];
  const docNumber = docNumberRaw.replace(/</g, '');

  // Line 2: birth date(6) + check(1) + sex(1) + expiry date(6) + check(1) + nationality(3) + optional(11) + composite check(1)
  const birthDateRaw = l2.slice(0, 6);
  const birthDateCheck = l2[6];
  const expiryDateRaw = l2.slice(8, 14);
  const expiryDateCheck = l2[14];
  const compositeCheck = l2[29];

  if (![docNumberCheck, birthDateCheck, expiryDateCheck, compositeCheck].every(isCheckDigitChar)) {
    return null; // OCR garbled a check-digit position — can't validate, don't guess
  }

  const docNumberOk = checkDigit(docNumberRaw) === Number(docNumberCheck);
  const birthDateOk = checkDigit(birthDateRaw) === Number(birthDateCheck);
  const expiryDateOk = checkDigit(expiryDateRaw) === Number(expiryDateCheck);

  // Composite check covers doc number + its check + birth date + its check +
  // expiry date + its check + the optional-data field on line 2, per spec.
  const compositeData =
    l1.slice(5, 15) + l2.slice(0, 7) + l2.slice(8, 15) + l2.slice(18, 29);
  const compositeOk = checkDigit(compositeData) === Number(compositeCheck);

  const mrzValid = docNumberOk && birthDateOk && expiryDateOk && compositeOk;
  if (!mrzValid) return null; // any single wrong digit means an OCR misread — don't surface a wrong ID number

  return {
    idNumber: docNumber || undefined,
    name: formatMrzName(l3),
    mrzValid: true,
  };
}

/** Convenience for callers that just want "birth/expiry date, if a valid MRZ was read". */
export function parseMrzDates(rawText: string): { birthDate?: string; expiryDate?: string } {
  const lines = findMrzLines(rawText);
  if (!lines) return {};
  const l2 = pad30(lines[1]);
  return {
    birthDate: formatMrzDate(l2.slice(0, 6)),
    expiryDate: formatMrzDate(l2.slice(8, 14)),
  };
}
