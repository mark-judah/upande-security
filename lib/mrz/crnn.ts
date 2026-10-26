import { LAYERS, WEIGHTS_F16_BASE64 } from './weights';

/**
 * The MRZ line recognizer (mrz-scanner/model/crnn.py) in plain TypeScript, so
 * it ships in an OTA update - no native ML runtime in the build. CNN with
 * BatchNorm folded in (export/to_ts.py) -> 2-layer bidirectional LSTM ->
 * per-column character scores -> greedy CTC decode.
 *
 * Input: one line, grayscale 32 x 320, values 0..1. Output: the line's text.
 */

export const LINE_H = 32;
export const LINE_W = 320;
const CHARSET = '<0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // CTC blank is index 0

type Ref = { offset: number; shape: readonly number[] };

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64Bytes(s: string): Uint8Array {
  const lookup = new Uint8Array(128);
  for (let i = 0; i < B64.length; i++) lookup[B64.charCodeAt(i)] = i;
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((s.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const n =
      (lookup[s.charCodeAt(i)] << 18) |
      (lookup[s.charCodeAt(i + 1)] << 12) |
      (lookup[s.charCodeAt(i + 2)] << 6) |
      lookup[s.charCodeAt(i + 3)];
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

function halfToFloat(h: number): number {
  const s = h & 0x8000 ? -1 : 1;
  const e = (h >> 10) & 0x1f;
  const f = h & 0x3ff;
  if (e === 0) return s * f * 2 ** -24;
  if (e === 31) return f ? NaN : s * Infinity;
  return s * (1 + f / 1024) * 2 ** (e - 15);
}

let params: Float32Array | null = null;

/** Decoded once, on first use (~2 MB of floats). */
function weights(): Float32Array {
  if (params) return params;
  const bytes = base64Bytes(WEIGHTS_F16_BASE64);
  const out = new Float32Array(bytes.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = halfToFloat(bytes[2 * i] | (bytes[2 * i + 1] << 8));
  params = out;
  return out;
}

/** Decode the weights ahead of the first scan. */
export function warmUp(): void {
  weights();
}

const view = (ref: Ref) => {
  const n = ref.shape.reduce((a, b) => a * b, 1);
  return weights().subarray(ref.offset, ref.offset + n);
};

/** 3x3 conv, padding 1, + bias + ReLU. x: C x H x W.
 * im2col into one contiguous row of c*9 values per output pixel, then dot
 * products four output channels at a time - running sums stay in locals,
 * which is several times faster in a JS engine than accumulating in arrays. */
function conv3x3(x: Float32Array, c: number, h: number, w: number, wt: Float32Array, bias: Float32Array, co: number) {
  const K = c * 9;
  const P = h * w;
  const cols = new Float32Array(P * K);
  for (let y = 0; y < h; y++) {
    for (let xx = 0; xx < w; xx++) {
      let o = (y * w + xx) * K;
      for (let i = 0; i < c; i++) {
        const ib = i * P;
        for (let ky = -1; ky <= 1; ky++) {
          const sy = y + ky;
          for (let kx = -1; kx <= 1; kx++) {
            const sx = xx + kx;
            cols[o++] = sy >= 0 && sy < h && sx >= 0 && sx < w ? x[ib + sy * w + sx] : 0;
          }
        }
      }
    }
  }
  const out = new Float32Array(co * P);
  for (let o = 0; o < co; o += 4) {
    const n = Math.min(4, co - o);
    const w0 = o * K;
    const w1 = (o + Math.min(1, n - 1)) * K;
    const w2 = (o + Math.min(2, n - 1)) * K;
    const w3 = (o + Math.min(3, n - 1)) * K;
    for (let p = 0; p < P; p++) {
      const cb = p * K;
      let a0 = 0, a1 = 0, a2 = 0, a3 = 0;
      for (let k = 0; k < K; k++) {
        const v = cols[cb + k];
        a0 += wt[w0 + k] * v;
        a1 += wt[w1 + k] * v;
        a2 += wt[w2 + k] * v;
        a3 += wt[w3 + k] * v;
      }
      const acc = [a0, a1, a2, a3];
      for (let j = 0; j < n; j++) {
        const r = acc[j] + bias[o + j];
        out[(o + j) * P + p] = r > 0 ? r : 0;
      }
    }
  }
  return out;
}

function maxPool(x: Float32Array, c: number, h: number, w: number, ph: number, pw: number) {
  const oh = Math.floor(h / ph);
  const ow = Math.floor(w / pw);
  const out = new Float32Array(c * oh * ow);
  for (let ch = 0; ch < c; ch++) {
    for (let y = 0; y < oh; y++) {
      for (let xx = 0; xx < ow; xx++) {
        let m = -Infinity;
        for (let a = 0; a < ph; a++) {
          const row = ch * h * w + (y * ph + a) * w + xx * pw;
          for (let b = 0; b < pw; b++) if (x[row + b] > m) m = x[row + b];
        }
        out[ch * oh * ow + y * ow + xx] = m;
      }
    }
  }
  return { out, h: oh, w: ow };
}

const sigmoid = (v: number) => 1 / (1 + Math.exp(-v));

/** One LSTM direction over T steps. seq: T x inSize. Gates i, f, g, o (PyTorch order). */
function lstm(seq: Float32Array, T: number, inSize: number, wih: Float32Array, whh: Float32Array, b: Float32Array, H: number, reverse: boolean) {
  const out = new Float32Array(T * H);
  const h = new Float32Array(H);
  const c = new Float32Array(H);
  const gates = new Float32Array(4 * H);
  for (let s = 0; s < T; s++) {
    const t = reverse ? T - 1 - s : s;
    const xb = t * inSize;
    for (let g = 0; g < 4 * H; g++) {
      let acc = b[g];
      const wi = g * inSize;
      for (let k = 0; k < inSize; k++) acc += wih[wi + k] * seq[xb + k];
      const wh = g * H;
      for (let k = 0; k < H; k++) acc += whh[wh + k] * h[k];
      gates[g] = acc;
    }
    for (let k = 0; k < H; k++) {
      const ig = sigmoid(gates[k]);
      const fg = sigmoid(gates[H + k]);
      const gg = Math.tanh(gates[2 * H + k]);
      const og = sigmoid(gates[3 * H + k]);
      c[k] = fg * c[k] + ig * gg;
      h[k] = og * Math.tanh(c[k]);
      out[t * H + k] = h[k];
    }
  }
  return out;
}

/** Recognize one line image (Float32Array of LINE_H * LINE_W, values 0..1). */
export function readLine(img: Float32Array): string {
  let x = img;
  let c = 1;
  let h = LINE_H;
  let w = LINE_W;
  let seq: Float32Array | null = null;
  let feat = 0;
  let T = 0;
  for (const layer of LAYERS) {
    if (layer.type === 'conv') {
      const co = layer.w.shape[0];
      x = conv3x3(x, c, h, w, view(layer.w), view(layer.b), co);
      c = co;
      if (layer.pool) ({ out: x, h, w } = maxPool(x, c, h, w, layer.pool[0], layer.pool[1]));
    } else if (layer.type === 'bilstm') {
      if (!seq) {
        // C x 1 x W -> W steps x C features
        T = w;
        feat = c;
        seq = new Float32Array(T * feat);
        for (let t = 0; t < T; t++) for (let k = 0; k < feat; k++) seq[t * feat + k] = x[k * w + t];
      }
      const H = layer.hidden;
      const [fw, bw] = layer.dirs;
      const f = lstm(seq, T, feat, view(fw.wih), view(fw.whh), view(fw.b), H, false);
      const r = lstm(seq, T, feat, view(bw.wih), view(bw.whh), view(bw.b), H, true);
      const next = new Float32Array(T * 2 * H);
      for (let t = 0; t < T; t++) {
        next.set(f.subarray(t * H, (t + 1) * H), t * 2 * H);
        next.set(r.subarray(t * H, (t + 1) * H), t * 2 * H + H);
      }
      seq = next;
      feat = 2 * H;
    } else {
      // Linear + greedy CTC: best class per step, collapse repeats, drop blanks.
      const wt = view(layer.w);
      const bias = view(layer.b);
      const classes = layer.w.shape[0];
      let text = '';
      let prev = 0;
      for (let t = 0; t < T; t++) {
        let best = 0;
        let bestV = -Infinity;
        for (let k = 0; k < classes; k++) {
          let acc = bias[k];
          for (let j = 0; j < feat; j++) acc += wt[k * feat + j] * seq![t * feat + j];
          if (acc > bestV) {
            bestV = acc;
            best = k;
          }
        }
        if (best !== prev && best !== 0) text += CHARSET[best - 1];
        prev = best;
      }
      return text;
    }
  }
  return '';
}
