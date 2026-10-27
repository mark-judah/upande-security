import { KERNELS_WASM_BASE64 } from './kernelsWasm';

/**
 * The WebAssembly build of kernels/kernels.c - the engine's hot loops with
 * SIMD. Loaded once by initKernels(); until then, or where WebAssembly SIMD
 * is missing (very old WebViews), crnn.ts and detect.ts use their plain-JS
 * versions, which give the same reads, only slower.
 */

type Exports = {
  memory: WebAssembly.Memory;
  heap_mark(): number;
  heap_reset(mark: number): void;
  alloc(bytes: number): number;
  gemm_nt(A: number, B: number, bias: number, out: number, M: number, N: number, K: number, ldo: number, relu: number): void;
  im2col3(x: number, cols: number, c: number, h: number, w: number): void;
  maxpool(x: number, out: number, c: number, h: number, w: number, ph: number, pw: number): void;
  transpose(x: number, out: number, rows: number, cols: number): void;
  lstm_dir(pre: number, T: number, whh: number, H: number, reverse: number, out: number, ldo: number, off: number, scratch: number): void;
  morph(src: number, dst: number, w: number, h: number, kw: number, kh: number, max: number, scratch: number): void;
  morph_scratch(w: number, h: number, kw: number, kh: number): number;
  resize_u8(src: number, w: number, h: number, dst: number, ow: number, oh: number, tmp: number): void;
  bar_pixels(g: number, w: number, h: number, k: number, kx: number): number;
};

let k: Exports | null = null;

function bytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Compile and start the module; false if this engine can't run it. */
export async function initKernels(): Promise<boolean> {
  if (k) return true;
  try {
    const module = await WebAssembly.compile(bytes(KERNELS_WASM_BASE64));
    const instance = await WebAssembly.instantiate(module);
    k = instance.exports as unknown as Exports;
    return true;
  } catch {
    return false;
  }
}

export const kernels = (): Exports | null => k;

/** Views into module memory - made fresh each time, as growing it detaches old ones. */
export const f32 = (ptr: number, n: number) => new Float32Array(k!.memory.buffer, ptr, n);
export const u8 = (ptr: number, n: number) => new Uint8Array(k!.memory.buffer, ptr, n);

/** Run fn with scratch allocations that are all released afterwards. */
export function scoped<T>(fn: (alloc: (bytes: number) => number) => T): T {
  const mark = k!.heap_mark();
  try {
    return fn((n) => {
      const p = k!.alloc(n);
      if (!p) throw new Error('MRZ kernels: out of memory');
      return p;
    });
  } finally {
    k!.heap_reset(mark);
  }
}

/** Separable min/max filter (detect.ts morph) in WebAssembly. */
export function morphWasm(src: Uint8Array, w: number, h: number, kw: number, kh: number, max: boolean): Uint8Array {
  return scoped((alloc) => {
    const s = alloc(w * h);
    const d = alloc(w * h);
    const tmp = alloc(k!.morph_scratch(w, h, kw, kh));
    u8(s, w * h).set(src);
    k!.morph(s, d, w, h, kw, kh, max ? 1 : 0, tmp);
    return u8(d, w * h).slice();
  });
}

/** cv2.resize of an 8-bit image (detect.ts resizeF + toU8) in WebAssembly. */
export function resizeU8Wasm(src: Uint8Array, w: number, h: number, ow: number, oh: number): Uint8Array {
  return scoped((alloc) => {
    const s = alloc(w * h);
    const d = alloc(ow * oh);
    const tmp = alloc(Math.max((h + 1) * ow, 3 * ow) * 4);
    u8(s, w * h).set(src);
    k!.resize_u8(s, w, h, d, ow, oh, tmp);
    return u8(d, ow * oh).slice();
  });
}

/** One connected component of the bar mask: pixel count and per-row x extents. */
export type Component = { n: number; rows: [y: number, first: number, last: number][] };

/** detect.ts bars() up to the components - black-hat, Otsu, close, label - in WebAssembly. */
export function barComponentsWasm(g: Uint8Array, w: number, h: number, ks: number, kx: number): Component[] {
  return scoped((alloc) => {
    const p = alloc(w * h);
    u8(p, w * h).set(g);
    const r = k!.bar_pixels(p, w, h, ks, kx);
    if (!r) throw new Error('MRZ kernels: out of memory');
    const head = new Int32Array(k!.memory.buffer, r, 1);
    const nc = head[0];
    const meta = new Int32Array(k!.memory.buffer, r, 1 + 2 * nc + 1);
    const total = meta[1 + 2 * nc];
    const rows = new Int32Array(k!.memory.buffer, r + (2 + 2 * nc) * 4, total * 3);
    const out: Component[] = [];
    for (let c = 0; c < nc; c++) {
      const a = meta[1 + nc + c];
      const b = c + 1 < nc ? meta[1 + nc + c + 1] : total;
      const list: Component['rows'] = [];
      for (let e = a; e < b; e++) list.push([rows[e * 3], rows[e * 3 + 1], rows[e * 3 + 2]]);
      out.push({ n: meta[1 + c], rows: list });
    }
    return out;
  });
}
