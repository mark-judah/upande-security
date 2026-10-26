import { checkDigit, parseMrz } from '../utils/mrz';
import { LINE_H, LINE_W, readLine, warmUp } from './crnn';
import { findMrz, lineCrop, resizeGray, turned, type Gray } from './detect';

/**
 * Photo (grayscale) in, the three MRZ lines out - only when they pass every
 * check the gate already applies (lib/utils/mrz.ts parseMrz), each exactly
 * 30 characters. Tries the three best-looking candidates, each also turned 180
 * degrees for a card held upside down. A refusal means "scan again", never
 * a guess. Runs inside a WebView (engineWeb.ts) for its JIT; plain TS so the
 * same code is tested in Node against the Python original.
 */

export type EngineResult = {
  lines: string[] | null;
  reason: 'ok' | 'no MRZ found' | 'did not check out';
  ms: number;
};

const MAX_SIDE = 1600;

/** Line 1's own check digit - a cheap way to skip a wrong candidate or the
 * wrong way up after reading one line instead of three. */
function line1Ok(l: string): boolean {
  return l.length === 30 && /\d/.test(l[14]) && checkDigit(l.slice(5, 14)) === Number(l[14]);
}

export function readMrz(photo: Gray): EngineResult {
  const t0 = Date.now();
  const long = Math.max(photo.w, photo.h);
  const img = long > MAX_SIDE ? resizeGray(photo, MAX_SIDE / long) : photo;
  const candidates = findMrz(img, 3);
  if (!candidates.length) return { lines: null, reason: 'no MRZ found', ms: Date.now() - t0 };
  const read = (q: Parameters<typeof lineCrop>[1]) => readLine(lineCrop(img, q, LINE_W, LINE_H));
  for (const quads of candidates) {
    for (const q of [quads, turned(quads)]) {
      const l1 = read(q[0]);
      if (!line1Ok(l1)) continue;
      const lines = [l1, read(q[1]), read(q[2])];
      if (lines.every((l) => l.length === 30) && parseMrz(lines.join('\n'))) {
        return { lines, reason: 'ok', ms: Date.now() - t0 };
      }
    }
  }
  return { lines: null, reason: 'did not check out', ms: Date.now() - t0 };
}

export { warmUp };
