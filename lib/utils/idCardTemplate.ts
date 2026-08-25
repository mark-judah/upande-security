import type { TextBlock, Frame } from './ocrAdapter';
import {
  ID_LABEL_RE,
  SERIAL_LABEL_RE,
  NAME_LABEL_RE,
  DATE_LIKE_RE,
  isBoilerplate,
  isFieldLabelLine,
} from './idCard';

/**
 * Label-anchored, position-based extractor for the CLASSIC (no-MRZ) Kenyan
 * ID card.
 *
 * idCard.ts's full-text regex heuristic is a fine best-effort guess for a
 * human-triggered manual capture — the guard sees the result and can retake
 * if it's wrong. It has no way to self-validate a read, though, which makes
 * it unsafe as the sole trigger for *unsupervised* continuous auto-capture:
 * a false positive there would silently save the wrong visitor's ID
 * number/name with no OCR-detectable evidence anything went wrong.
 *
 * This file adds a second, independent signal instead: does a matched LABEL
 * (found at a plausible position relative to its value, not just "found
 * somewhere on the card") actually anchor the extracted field. `confident`
 * only goes true when both fields are shape-plausible AND at least one came
 * from real label evidence — see `extractIdCardTemplate` below.
 *
 * Label vocabulary reuse: ID_LABEL_RE / SERIAL_LABEL_RE / NAME_LABEL_RE and
 * the isBoilerplate() / isFieldLabelLine() helpers (which cover the
 * BOILERPLATE / FIELD_LABEL_LINES string lists) are imported directly from
 * idCard.ts (exported there for this purpose) so the two files' label
 * knowledge can't drift apart. The one exception is `ID_LABEL_ANCHOR_RE`
 * below — idCard.ts's own ID_LABEL_RE requires the digits to be captured in
 * the *same* regex match (same OCR line), which is exactly right for
 * idCard.ts's plain-text scan but not for detecting a label that sits on
 * its own line/block with the value found elsewhere by position. That one
 * regex is hand-mirrored from ID_LABEL_RE's label alternation (minus the
 * trailing digit requirement) — keep the two in sync by hand if either
 * changes. The fuzzy (Levenshtein) token lists further below are a second,
 * hand-maintained safety net for OCR-noised labels that neither regex
 * catches; see the comment above them for why they're deliberately a
 * fallback rather than the primary path.
 */

export type TemplateIdResult = {
  idNumber?: string;
  name?: string;
  confident: boolean;
};

type PositionedLine = {
  /** Raw (trimmed, original-case) OCR text — for regex matching against idCard.ts's patterns. */
  text: string;
  /** Uppercased, punctuation-stripped, whitespace-collapsed — for shape/fuzzy checks. */
  norm: string;
  frame: Frame;
};

// Mirrors ID_LABEL_RE's label alternation minus the inline-digit
// requirement — see file header comment.
const ID_LABEL_ANCHOR_RE = /\b(ID\s*(NO\.?|NUMBER)?|NAMBA\s*YA\s*KITAMBULISHO)\b/i;

const ID_SHAPE_RE = /^\d{6,9}$/;
const NAME_SHAPE_RE = /^[A-Z][A-Z ]{3,}$/;

// Secondary fuzzy-match fallback vocabulary, only consulted when the strict
// regexes above find zero anchors anywhere on the card. Kept deliberately
// small and only used as a fallback (rather than the primary path) because
// unlike the regexes above, plain substring/edit-distance matching on short
// tokens like "ID" is more prone to false positives (see `fuzzyMatchesToken`
// for the word-boundary guard that keeps this reasonably safe). Swahili
// tokens are included per spec but are the least-tested part of this file —
// flagging that as a real caveat, not a confirmed-good path.
const ID_LABEL_FUZZY_TOKENS = ['ID NO', 'ID NUMBER', 'ID', 'NAMBA YA KITAMBULISHO'];
const NAME_LABEL_FUZZY_TOKENS = [
  'FULL NAMES',
  'FULL NAME',
  'SURNAME',
  'NAMES',
  'NAME',
  'MAJINA KAMILI',
  'JINA LA UKOO',
];

function normalize(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeWords(norm: string): string[] {
  return norm.split(' ').filter(Boolean);
}

/** True when `tokenWords` appears as a contiguous run within `words`. */
function containsWordSequence(words: string[], tokenWords: string[]): boolean {
  if (tokenWords.length === 0 || tokenWords.length > words.length) return false;
  for (let i = 0; i + tokenWords.length <= words.length; i++) {
    let matched = true;
    for (let j = 0; j < tokenWords.length; j++) {
      if (words[i + j] !== tokenWords[j]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

/** Plain Levenshtein distance — only ever called on short label tokens, so this is cheap. */
function levenshtein(a: string, b: string): number {
  const dp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    dp.push(new Array(b.length + 1).fill(0));
    dp[i][0] = i;
  }
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp[a.length][b.length];
}

/**
 * True when normalized `norm` is a plausible OCR rendering of `token` —
 * exact whole-word-sequence containment first (so a single-word token like
 * "ID" can never match merely because it's a substring of a longer word
 * like "IDENTITY" — word-boundary safe, unlike a naive `.includes()`), and
 * only then a whole-line small-edit-distance fallback for genuine character
 * noise (e.g. "1D NO" for "ID NO"), gated on the line having the same word
 * count as the token so it can't drift into matching unrelated short words.
 */
function fuzzyMatchesToken(norm: string, token: string): boolean {
  if (!norm) return false;
  const words = tokenizeWords(norm);
  const tokenWords = tokenizeWords(token);
  if (containsWordSequence(words, tokenWords)) return true;
  if (words.length === tokenWords.length && Math.abs(norm.length - token.length) <= 2) {
    const maxDistance = token.length <= 4 ? 1 : 2;
    if (levenshtein(norm, token) <= maxDistance) return true;
  }
  return false;
}

function matchesAnyToken(norm: string, tokens: string[]): boolean {
  return tokens.some((t) => fuzzyMatchesToken(norm, t));
}

function isIdLabelAnchor(text: string): boolean {
  return ID_LABEL_ANCHOR_RE.test(text) && !SERIAL_LABEL_RE.test(text);
}

function isSerialLabelAnchor(text: string): boolean {
  return SERIAL_LABEL_RE.test(text);
}

function isNameLabelAnchor(text: string): boolean {
  return NAME_LABEL_RE.test(text);
}

/** Never a usable value — it's a label, a field caption, or card boilerplate. */
function isKnownLabelOrBoilerplate(line: PositionedLine): boolean {
  return (
    isBoilerplate(line.text) ||
    isFieldLabelLine(line.text) ||
    isIdLabelAnchor(line.text) ||
    isSerialLabelAnchor(line.text) ||
    isNameLabelAnchor(line.text) ||
    matchesAnyToken(line.norm, ID_LABEL_FUZZY_TOKENS) ||
    matchesAnyToken(line.norm, NAME_LABEL_FUZZY_TOKENS)
  );
}

function flattenPositionedLines(blocks: TextBlock[]): PositionedLine[] {
  const lines: PositionedLine[] = [];
  for (const block of blocks) {
    for (const line of block.lines) {
      if (!line.frame) continue; // no geometry to anchor against — can't participate
      const text = line.text.trim();
      if (!text) continue;
      lines.push({ text, norm: normalize(text), frame: line.frame });
    }
  }
  return lines;
}

// Tolerances expressed relative to line height/width rather than fixed
// pixel counts, for the same reason as mrz.ts's geometry tolerances: source
// image resolution varies, relative layout doesn't.
const SAME_ROW_TOLERANCE_RATIO = 0.6;
const STACK_GAP_RATIO_MAX = 1.6;

/** Value sits to the right of the label on roughly the same vertical band — "ID NO: 12345678" split across blocks. */
function isSameRowToRight(label: Frame, candidate: Frame): boolean {
  const labelMidY = label.top + label.height / 2;
  const candidateMidY = candidate.top + candidate.height / 2;
  const tolerance = Math.max(label.height, candidate.height) * SAME_ROW_TOLERANCE_RATIO;
  const levelEnough = Math.abs(labelMidY - candidateMidY) <= tolerance;
  const toTheRight = candidate.left >= label.left + label.width * 0.4;
  return levelEnough && toTheRight;
}

/** Value sits directly below the label, close enough to be the very next line — "FULL NAMES" \n "JOHN KAMAU OTIENO". */
function isStackedBelow(label: Frame, candidate: Frame): boolean {
  const gap = candidate.top - (label.top + label.height);
  if (gap < -label.height * 0.3) return false; // overlapping/above — not "below"
  const maxGap = Math.max(label.height, candidate.height) * STACK_GAP_RATIO_MAX;
  const leftAligned =
    Math.abs(candidate.left - label.left) <= Math.max(label.height, candidate.height) * 1.5;
  return gap <= maxGap && leftAligned;
}

/**
 * Finds the best value line near a label line: same-row-to-the-right wins
 * over stacked-below when both exist (same-row is the stronger signal for
 * "this value belongs to this label"), excluding anything that's itself a
 * known label/boilerplate line and anything the caller's shape check rejects.
 */
function findValueNear(
  label: PositionedLine,
  lines: PositionedLine[],
  isPlausibleValue: (candidate: PositionedLine) => boolean,
): PositionedLine | null {
  let sameRowBest: PositionedLine | null = null;
  let stackedBest: PositionedLine | null = null;

  for (const candidate of lines) {
    if (candidate === label) continue;
    if (isKnownLabelOrBoilerplate(candidate)) continue;
    if (!isPlausibleValue(candidate)) continue;

    if (isSameRowToRight(label.frame, candidate.frame)) {
      if (!sameRowBest || candidate.frame.left < sameRowBest.frame.left) sameRowBest = candidate;
    } else if (isStackedBelow(label.frame, candidate.frame)) {
      if (!stackedBest || candidate.frame.top < stackedBest.frame.top) stackedBest = candidate;
    }
  }

  return sameRowBest ?? stackedBest;
}

/**
 * Extracts `idNumber` and `name` from a classic (no-MRZ) Kenyan ID's OCR
 * blocks, anchored on known field labels found at plausible positions
 * relative to their values. See file header for the confidence contract.
 */
export function extractIdCardTemplate(blocks: TextBlock[]): TemplateIdResult {
  const lines = flattenPositionedLines(blocks);

  // The Serial Number field (and whatever sits in its same-row/stacked-below
  // value zone) is excluded from ID-number consideration everywhere below —
  // same reasoning as idCard.ts's own exclusion: it's also a bare 6-9 digit
  // run and would otherwise be indistinguishable in shape from the real ID
  // number.
  const serialAnchors = lines.filter((l) => isSerialLabelAnchor(l.text));
  const isInSerialZone = (candidate: PositionedLine) =>
    serialAnchors.some(
      (s) => isSameRowToRight(s.frame, candidate.frame) || isStackedBelow(s.frame, candidate.frame),
    );

  let idNumber: string | undefined;
  let idFromLabel = false;

  // Case A: label + digits on the same OCR line — reuse idCard.ts's own
  // combined regex verbatim; this is the exact match idCard.ts's
  // extractIdNumber would make for this layout.
  for (const line of lines) {
    if (isSerialLabelAnchor(line.text)) continue;
    const inline = ID_LABEL_RE.exec(line.text);
    if (inline) {
      idNumber = inline[3];
      idFromLabel = true;
      break;
    }
  }

  // Case B: label on its own line/block, value found by position. Strict
  // regex pass first, then a fuzzy pass only if the strict pass found no
  // anchors at all anywhere on the card.
  if (!idNumber) {
    let idAnchors = lines.filter((l) => isIdLabelAnchor(l.text) && !isBoilerplate(l.text));
    if (idAnchors.length === 0) {
      idAnchors = lines.filter(
        (l) => matchesAnyToken(l.norm, ID_LABEL_FUZZY_TOKENS) && !isBoilerplate(l.text),
      );
    }
    for (const anchor of idAnchors) {
      const value = findValueNear(
        anchor,
        lines,
        (candidate) =>
          ID_SHAPE_RE.test(candidate.norm.replace(/\s+/g, '')) &&
          !isInSerialZone(candidate) &&
          // A date's punctuation ("12.05.1985") gets stripped by norm's
          // non-alphanumeric replacement, collapsing it into an 8-digit
          // string that would otherwise pass the shape check above — test
          // against the raw text, before that stripping happens, same as
          // idCard.ts's own extractIdNumber does for its fallback path.
          !DATE_LIKE_RE.test(candidate.text),
      );
      if (value) {
        idNumber = value.norm.replace(/\s+/g, '');
        idFromLabel = true;
        break;
      }
    }
  }

  if (!idNumber) {
    // Last resort — bare digit-shape guess, still outside the serial
    // number's zone. No label evidence, so on its own this can never flip
    // `confident` true.
    const candidate = lines.find(
      (l) =>
        !isKnownLabelOrBoilerplate(l) &&
        !isInSerialZone(l) &&
        !DATE_LIKE_RE.test(l.text) &&
        ID_SHAPE_RE.test(l.norm.replace(/\s+/g, '')),
    );
    if (candidate) idNumber = candidate.norm.replace(/\s+/g, '');
  }

  let name: string | undefined;
  let nameFromLabel = false;

  let nameAnchors = lines.filter((l) => isNameLabelAnchor(l.text));
  if (nameAnchors.length === 0) {
    nameAnchors = lines.filter((l) => matchesAnyToken(l.norm, NAME_LABEL_FUZZY_TOKENS));
  }
  for (const anchor of nameAnchors) {
    const value = findValueNear(
      anchor,
      lines,
      (candidate) =>
        NAME_SHAPE_RE.test(candidate.norm) && tokenizeWords(candidate.norm).length >= 2,
    );
    if (value) {
      name = value.text.trim();
      nameFromLabel = true;
      break;
    }
  }

  if (!name) {
    const candidate = lines.find(
      (l) =>
        !isKnownLabelOrBoilerplate(l) &&
        NAME_SHAPE_RE.test(l.norm) &&
        tokenizeWords(l.norm).length >= 2,
    );
    if (candidate) name = candidate.text.trim();
  }

  const idShapeOk = !!idNumber && ID_SHAPE_RE.test(idNumber);
  const nameShapeOk = !!name && name.trim().split(/\s+/).filter(Boolean).length >= 2;

  return {
    idNumber,
    name,
    // Both fields must be label-anchored, not just one — an anchor on field
    // A is evidence about field A only. Letting it wave through an
    // unanchored bare-shape guess on field B (via `||`) let unrelated
    // all-caps card text (e.g. a district/place-of-birth value) or a
    // mis-shaped digit run ride into a "confident" result on the strength
    // of the *other* field's anchor alone — exactly the false-positive this
    // file exists to prevent.
    confident: idShapeOk && nameShapeOk && idFromLabel && nameFromLabel,
  };
}
