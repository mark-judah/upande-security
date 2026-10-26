/**
 * MRZ line finder and line cropper - a port of mrz-scanner/detect/band.py and
 * synth/render.py's line_crop, step for step with the OpenCV calls they use,
 * so the boxes match the ones the recognizer was tuned on.
 *
 * 1. Black-hat: dark print on the light card stands out, flat areas vanish.
 * 2. A horizontal close joins each line's characters into one bar. An MRZ
 *    line has no spaces (every gap is a '<'), so it closes into one long bar;
 *    the card's other text breaks at the spaces between words.
 * 3. The MRZ is the triple of bars that are parallel, equally long, equally
 *    spaced and start at the same place - searched over a few character sizes.
 */

export type Gray = { data: Uint8Array; w: number; h: number };
export type Pt = [number, number];
export type Quad = [Pt, Pt, Pt, Pt]; // tl, tr, br, bl

const ANALYSIS_H = 14;
const MAX_SIDE = 2000;
// Bar -> recognizer box (measured in mrz-scanner, detect/band.py).
const BOX_HEIGHT = 1.61;
const BOX_SHIFT_DOWN = 0.124;
const BOX_LENGTH = 1.014;
// line_crop margins (vertical, horizontal) x line box height.
const MARGIN_Y = 0.2;
const MARGIN_X = 0.3;

/* ---------- image operations (OpenCV semantics) ---------- */

export function toGray(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number): Gray {
  const data = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < data.length; i++, p += 4) {
    data[i] = Math.round(0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]);
  }
  return { data, w, h };
}

/** Area-average resize along one axis (INTER_AREA when shrinking). */
function areaAxis(src: Float32Array, n: number, stride: number, count: number, step: number, outN: number): Float32Array {
  // src holds `count` lines of n samples; sample k of line j at j*step + k*stride.
  const out = new Float32Array(count * outN);
  const s = n / outN;
  for (let o = 0; o < outN; o++) {
    const a = o * s;
    const b = a + s;
    const i0 = Math.floor(a);
    const i1 = Math.min(n, Math.ceil(b));
    for (let j = 0; j < count; j++) {
      let acc = 0;
      for (let i = i0; i < i1; i++) {
        const wgt = Math.min(b, i + 1) - Math.max(a, i);
        acc += wgt * src[j * step + i * stride];
      }
      out[j * outN + o] = acc / s;
    }
  }
  return out;
}

/** Bilinear resize (INTER_LINEAR when growing). */
function linear(src: Float32Array, w: number, h: number, ow: number, oh: number): Float32Array {
  const out = new Float32Array(ow * oh);
  const sx = w / ow;
  const sy = h / oh;
  for (let y = 0; y < oh; y++) {
    let fy = (y + 0.5) * sy - 0.5;
    if (fy < 0) fy = 0;
    const y0 = Math.min(Math.floor(fy), h - 1);
    const y1 = Math.min(y0 + 1, h - 1);
    const ay = fy - y0;
    for (let x = 0; x < ow; x++) {
      let fx = (x + 0.5) * sx - 0.5;
      if (fx < 0) fx = 0;
      const x0 = Math.min(Math.floor(fx), w - 1);
      const x1 = Math.min(x0 + 1, w - 1);
      const ax = fx - x0;
      const top = src[y0 * w + x0] * (1 - ax) + src[y0 * w + x1] * ax;
      const bot = src[y1 * w + x0] * (1 - ax) + src[y1 * w + x1] * ax;
      out[y * ow + x] = top * (1 - ay) + bot * ay;
    }
  }
  return out;
}

/** Resize as cv2.resize: INTER_AREA to shrink, INTER_LINEAR to grow. Values stay float. */
export function resizeF(src: Float32Array, w: number, h: number, ow: number, oh: number): Float32Array {
  if (ow > w || oh > h) return linear(src, w, h, ow, oh);
  // Rows first (each of h rows: w -> ow), then columns (each of ow columns: h -> oh).
  const rows = areaAxis(src, w, 1, h, w, ow); // h x ow
  const cols = areaAxis(rows, h, ow, ow, 1, oh); // ow lines of oh -> stored column-major
  const out = new Float32Array(ow * oh);
  for (let x = 0; x < ow; x++) for (let y = 0; y < oh; y++) out[y * ow + x] = cols[x * oh + y];
  return out;
}

/** A grayscale image scaled by `scale` (< 1: area average). */
export function resizeGray(img: Gray, scale: number): Gray {
  const w = Math.round(img.w * scale);
  const h = Math.round(img.h * scale);
  return { data: toU8(resizeF(Float32Array.from(img.data), img.w, img.h, w, h)), w, h };
}

function toU8(f: Float32Array): Uint8Array {
  const out = new Uint8Array(f.length);
  for (let i = 0; i < f.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(f[i])));
  return out;
}

/** Separable min/max filter with a kw x kh rectangle, anchor at its centre;
 * pixels outside the image are ignored (OpenCV's default morphology border). */
function morph(src: Uint8Array, w: number, h: number, kw: number, kh: number, max: boolean): Uint8Array {
  const ax = Math.floor(kw / 2);
  const ay = Math.floor(kh / 2);
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const r = y * w;
    for (let x = 0; x < w; x++) {
      let m = max ? 0 : 255;
      const a = Math.max(0, x - ax);
      const b = Math.min(w - 1, x - ax + kw - 1);
      for (let i = a; i <= b; i++) {
        const v = src[r + i];
        if (max ? v > m : v < m) m = v;
      }
      tmp[r + x] = m;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = max ? 0 : 255;
      const a = Math.max(0, y - ay);
      const b = Math.min(h - 1, y - ay + kh - 1);
      for (let i = a; i <= b; i++) {
        const v = tmp[i * w + x];
        if (max ? v > m : v < m) m = v;
      }
      out[y * w + x] = m;
    }
  }
  return out;
}

const close = (src: Uint8Array, w: number, h: number, kw: number, kh: number) =>
  morph(morph(src, w, h, kw, kh, true), w, h, kw, kh, false);

/** OpenCV's Otsu threshold value. */
function otsu(src: Uint8Array): number {
  const hist = new Float64Array(256);
  for (let i = 0; i < src.length; i++) hist[src[i]]++;
  const n = src.length;
  let mu = 0;
  for (let i = 0; i < 256; i++) mu += i * hist[i];
  mu /= n;
  let q1 = 0;
  let mu1 = 0;
  let best = 0;
  let maxVal = 0;
  for (let i = 0; i < 256; i++) {
    const p = hist[i] / n;
    const q2 = 1 - q1 - p;
    // incremental class means, as in OpenCV's getThreshVal_Otsu_8u
    const q1n = q1 + p;
    if (Math.min(q1n, q2) < 1e-7 || Math.max(q1n, q2) > 1 - 1e-7) {
      mu1 = q1n > 0 ? (mu1 * q1 + i * p) / q1n : 0;
      q1 = q1n;
      continue;
    }
    mu1 = (mu1 * q1 + i * p) / q1n;
    q1 = q1n;
    const mu2 = (mu - q1 * mu1) / q2;
    const sigma = q1 * q2 * (mu1 - mu2) * (mu1 - mu2);
    if (sigma > maxVal) {
      maxVal = sigma;
      best = i;
    }
  }
  return best;
}

/* ---------- bars ---------- */

type Bar = { cx: number; cy: number; ux: number; uy: number; length: number; thickness: number };

/** Convex hull (monotone chain) of integer points. */
function hull(pts: Pt[]): Pt[] {
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/** Minimum-area rectangle of a convex polygon (rotating calipers over its edges). */
function minAreaRect(poly: Pt[]): Bar | null {
  if (poly.length < 3) return null;
  let best: Bar | null = null;
  let bestArea = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len === 0) continue;
    const ex = (x1 - x0) / len;
    const ey = (y1 - y0) / len;
    let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
    for (const [px, py] of poly) {
      const a = px * ex + py * ey;
      const b = -px * ey + py * ex;
      if (a < minA) minA = a;
      if (a > maxA) maxA = a;
      if (b < minB) minB = b;
      if (b > maxB) maxB = b;
    }
    const area = (maxA - minA) * (maxB - minB);
    if (area < bestArea) {
      bestArea = area;
      const ca = (minA + maxA) / 2;
      const cb = (minB + maxB) / 2;
      const cx = ca * ex - cb * ey;
      const cy = ca * ey + cb * ex;
      let w = maxA - minA, t = maxB - minB, ux = ex, uy = ey;
      if (t > w) {
        [w, t] = [t, w];
        [ux, uy] = [-ey, ex];
      }
      if (ux < 0) {
        ux = -ux;
        uy = -uy;
      }
      best = { cx, cy, ux, uy, length: w, thickness: t };
    }
  }
  return best;
}

/** Line-shaped bars in an image whose characters are ~ANALYSIS_H tall. */
function bars(g: Uint8Array, w: number, h: number): Bar[] {
  const H = ANALYSIS_H;
  const k = Math.floor(H * 0.8) | 1;
  const closed = close(g, w, h, k, k);
  const bh = new Uint8Array(w * h);
  for (let i = 0; i < bh.length; i++) bh[i] = Math.max(0, closed[i] - g[i]);
  let t = otsu(bh);
  if (t < 12) t = 12;
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < bin.length; i++) bin[i] = bh[i] > t ? 255 : 0;
  const bw = close(bin, w, h, Math.floor(H * 0.9), 3);

  // 8-connected components (union-find), each kept as per-row x extremes.
  const label = new Int32Array(w * h).fill(-1);
  const parent: number[] = [];
  const find = (a: number): number => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]];
    return a;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!bw[i]) continue;
      let l = -1;
      const nbrs = [x > 0 ? i - 1 : -1, y > 0 && x > 0 ? i - w - 1 : -1, y > 0 ? i - w : -1, y > 0 && x < w - 1 ? i - w + 1 : -1];
      for (const n of nbrs) {
        if (n < 0 || label[n] < 0) continue;
        const r = find(label[n]);
        if (l < 0) l = r;
        else if (r !== l) {
          parent[Math.max(r, l)] = Math.min(r, l);
          l = Math.min(r, l);
        }
      }
      if (l < 0) {
        l = parent.length;
        parent.push(l);
      }
      label[i] = l;
    }
  }
  const comps = new Map<number, { pts: Pt[]; n: number; rows: Map<number, [number, number]> }>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = label[y * w + x];
      if (l < 0) continue;
      const r = find(l);
      let c = comps.get(r);
      if (!c) comps.set(r, (c = { pts: [], n: 0, rows: new Map() }));
      c.n++;
      const row = c.rows.get(y);
      if (!row) c.rows.set(y, [x, x]);
      else row[1] = x;
    }
  }
  const out: Bar[] = [];
  for (const c of comps.values()) {
    if (c.n < 5) continue;
    const pts: Pt[] = [];
    for (const [y, [a, b]] of c.rows) {
      pts.push([a, y]);
      if (b !== a) pts.push([b, y]);
    }
    const r = minAreaRect(hull(pts));
    if (!r) continue;
    if (!(15 * H <= r.length && r.length <= 60 * H && 0.4 * H <= r.thickness && r.thickness <= 2.5 * H && r.length >= 8 * r.thickness)) continue;
    out.push(r);
  }
  return out;
}

function score(trio: Bar[]): number | null {
  let ux = 0, uy = 0;
  for (const b of trio) {
    ux += b.ux;
    uy += b.uy;
  }
  const n = Math.hypot(ux, uy);
  ux /= n;
  uy /= n;
  if (Math.min(...trio.map((b) => b.ux * ux + b.uy * uy)) < Math.cos((5 * Math.PI) / 180)) return null;
  const lengths = trio.map((b) => b.length);
  if (Math.min(...lengths) < 0.8 * Math.max(...lengths)) return null;
  const vx = -uy, vy = ux;
  const across = trio.map((b) => b.cx * vx + b.cy * vy).sort((a, b) => a - b);
  const d1 = across[1] - across[0];
  const d2 = across[2] - across[1];
  const t = median(trio.map((b) => b.thickness));
  if (!(1.1 * t <= d1 && d1 <= 4 * t && 1.1 * t <= d2 && d2 <= 4 * t) || Math.abs(d1 - d2) > (0.25 * (d1 + d2)) / 2) return null;
  const along = trio.map((b) => b.cx * ux + b.cy * uy);
  const meanL = lengths.reduce((a, b) => a + b, 0) / 3;
  if (Math.max(...along) - Math.min(...along) > 0.12 * meanL) return null;
  return meanL * (1 - Math.abs(d1 - d2) / (d1 + d2)) * (Math.min(...lengths) / Math.max(...lengths));
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[1];

function quads(trio: Bar[], scale: number): Quad[] {
  let ux = 0, uy = 0;
  for (const b of trio) {
    ux += b.ux;
    uy += b.uy;
  }
  const n = Math.hypot(ux, uy);
  ux /= n;
  uy /= n;
  const vx = -uy, vy = ux;
  const thick = median(trio.map((b) => b.thickness));
  const htx = (vx * thick * BOX_HEIGHT) / 2, hty = (vy * thick * BOX_HEIGHT) / 2;
  return [...trio]
    .sort((a, b) => a.cx * vx + a.cy * vy - (b.cx * vx + b.cy * vy))
    .map((b) => {
      const cx = b.cx + vx * thick * BOX_SHIFT_DOWN;
      const cy = b.cy + vy * thick * BOX_SHIFT_DOWN;
      const hlx = (ux * b.length * BOX_LENGTH) / 2, hly = (uy * b.length * BOX_LENGTH) / 2;
      const p = (x: number, y: number): Pt => [x / scale, y / scale];
      return [p(cx - hlx - htx, cy - hly - hty), p(cx + hlx - htx, cy + hly - hty), p(cx + hlx + htx, cy + hly + hty), p(cx - hlx + htx, cy - hly + hty)] as Quad;
    });
}

function combos<T>(xs: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) for (let k = j + 1; k < xs.length; k++) out.push([xs[i], xs[j], xs[k]]);
  return out;
}

/** Up to `top` candidate MRZs, best first: each its 3 line boxes, top to bottom. */
export function findMrz(img: Gray, top = 3): Quad[][] {
  const src = Float32Array.from(img.data);
  const found: { s: number; q: Quad[] }[] = [];
  for (const charH of [8, 12, 18, 27, 40, 60]) {
    const scale = ANALYSIS_H / charH;
    const long = Math.max(img.w, img.h) * scale;
    if (long < 300 || long > MAX_SIDE) continue;
    const w = Math.round(img.w * scale);
    const h = Math.round(img.h * scale);
    const g = toU8(resizeF(src, img.w, img.h, w, h));
    const bs = bars(g, w, h).sort((a, b) => b.length - a.length).slice(0, 25);
    for (const trio of combos(bs)) {
      const s = score(trio);
      if (s !== null) found.push({ s: s / scale, q: quads(trio, (w / img.w + h / img.h) / 2) });
    }
  }
  found.sort((a, b) => b.s - a.s);
  const centre = (q: Quad[]) => {
    let x = 0, y = 0;
    for (const quad of q) for (const [px, py] of quad) {
      x += px / 12;
      y += py / 12;
    }
    return [x, y];
  };
  const out: Quad[][] = [];
  for (const f of found) {
    const [cx, cy] = centre(f.q);
    if (out.every((o) => {
      const [ox, oy] = centre(o);
      return Math.hypot(cx - ox, cy - oy) > 20;
    })) out.push(f.q);
    if (out.length === top) break;
  }
  return out;
}

/** The same three lines read with the card turned 180 degrees (see band.py). */
export function turned(q: Quad[]): Quad[] {
  return [...q].reverse().map((quad) => {
    const dx = (quad[3][0] - quad[0][0]) * ((2 * BOX_SHIFT_DOWN) / BOX_HEIGHT);
    const dy = (quad[3][1] - quad[0][1]) * ((2 * BOX_SHIFT_DOWN) / BOX_HEIGHT);
    const m = quad.map(([x, y]) => [x - dx, y - dy] as Pt);
    return [m[2], m[3], m[0], m[1]] as Quad;
  });
}

/* ---------- line crop ---------- */

/** 3x3 homography mapping the 4 `from` points onto the 4 `to` points. */
function homography(from: Pt[], to: Pt[]): number[] {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i];
    const [u, v] = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  const hm = A.map((row, i) => row[8] / row[i]);
  return [...hm, 1];
}

/** One line, straightened to `outH` px high and resized to outW x outH, values 0..1
 * (synth/render.py line_crop with fixed margins, then cv2.resize INTER_AREA). */
export function lineCrop(img: Gray, quad: Quad, outW: number, outH: number): Float32Array {
  const [tl, tr, br, bl] = quad;
  const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const wq = Math.max(dist(tr, tl), dist(br, bl));
  const hq = Math.max(dist(bl, tl), dist(br, tr));
  const m = hq * MARGIN_Y;
  const mx = hq * MARGIN_X;
  const unit = (a: Pt, b: Pt): Pt => {
    const d = Math.max(dist(a, b), 1e-6);
    return [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
  };
  const ux = unit(tl, tr);
  const uy = unit(tl, bl);
  const off = (p: Pt, sx: number, sy: number): Pt => [p[0] + ux[0] * sx * mx + uy[0] * sy * m, p[1] + ux[1] * sx * mx + uy[1] * sy * m];
  const src: Pt[] = [off(tl, -1, -1), off(tr, 1, -1), off(br, 1, 1), off(bl, -1, 1)];
  const cropW = Math.round(((wq + 2 * mx) * outH) / (hq + 2 * m));
  const dst: Pt[] = [[0, 0], [cropW, 0], [cropW, outH], [0, outH]];
  const H = homography(dst, src); // crop pixel -> photo pixel
  const crop = new Float32Array(cropW * outH);
  const { data, w, h } = img;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < cropW; x++) {
      const d = H[6] * x + H[7] * y + H[8];
      let sx = (H[0] * x + H[1] * y + H[2]) / d;
      let sy = (H[3] * x + H[4] * y + H[5]) / d;
      sx = Math.min(Math.max(sx, 0), w - 1);
      sy = Math.min(Math.max(sy, 0), h - 1);
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
      const ax = sx - x0, ay = sy - y0;
      crop[y * cropW + x] =
        (data[y0 * w + x0] * (1 - ax) + data[y0 * w + x1] * ax) * (1 - ay) +
        (data[y1 * w + x0] * (1 - ax) + data[y1 * w + x1] * ax) * ay;
    }
  }
  // cv2.warpPerspective writes 8-bit pixels; round as it does before resizing.
  const u8 = Float32Array.from(toU8(crop));
  const sized = toU8(resizeF(u8, cropW, outH, outW, outH));
  const out = new Float32Array(outW * outH);
  for (let i = 0; i < out.length; i++) out[i] = sized[i] / 255;
  return out;
}
