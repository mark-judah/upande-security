/*
 * The MRZ engine's hot loops in C, compiled to WebAssembly with SIMD
 * (scripts/build-mrz-engine.sh). A low-end phone runs plain JS 10x+ slower
 * than a laptop; these few loops are nearly all of a scan's time. crnn.ts and
 * detect.ts call them through kernels.ts, which owns the memory layout.
 *
 * Everything is single precision, row-major, no libc.
 */
#include <wasm_simd128.h>

#define EXPORT(name) __attribute__((export_name(#name)))

/* ---------- bump allocator over the module's linear memory ---------- */

extern unsigned char __heap_base;
static unsigned long top = 0;

EXPORT(heap_mark) unsigned long heap_mark(void) {
  if (!top) top = ((unsigned long)&__heap_base + 15) & ~15ul;
  return top;
}

EXPORT(heap_reset) void heap_reset(unsigned long mark) { top = mark; }

EXPORT(alloc) unsigned long alloc(unsigned long bytes) {
  unsigned long p = heap_mark();
  unsigned long end = (p + bytes + 15) & ~15ul;
  unsigned long have = __builtin_wasm_memory_size(0) * 65536ul;
  if (end > have) {
    if (__builtin_wasm_memory_grow(0, (end - have + 65535) / 65536) == (unsigned long)-1) return 0;
  }
  top = end;
  return p;
}

/* ---------- dense algebra ---------- */

static inline float hsum(v128_t v) {
  return wasm_f32x4_extract_lane(v, 0) + wasm_f32x4_extract_lane(v, 1) +
         wasm_f32x4_extract_lane(v, 2) + wasm_f32x4_extract_lane(v, 3);
}

/*
 * out[m * ldo + n] = bias[m] + sum_k A[m * K + k] * B[n * K + k]   (A . B^T)
 * then ReLU if relu. Rows of A and B are contiguous K floats. Blocks of
 * 4 rows of A x 2 rows of B keep eight vector sums in registers.
 */
EXPORT(gemm_nt)
void gemm_nt(const float *A, const float *B, const float *bias, float *out, int M, int N, int K, int ldo, int relu) {
  const int K4 = K & ~3;
  int m = 0;
  for (; m + 4 <= M; m += 4) {
    const float *a0 = A + (m + 0) * K, *a1 = A + (m + 1) * K, *a2 = A + (m + 2) * K, *a3 = A + (m + 3) * K;
    int n = 0;
    for (; n + 2 <= N; n += 2) {
      const float *b0 = B + n * K, *b1 = B + (n + 1) * K;
      v128_t s00 = wasm_f32x4_splat(0), s01 = s00, s10 = s00, s11 = s00, s20 = s00, s21 = s00, s30 = s00, s31 = s00;
      for (int k = 0; k < K4; k += 4) {
        v128_t x0 = wasm_v128_load(b0 + k), x1 = wasm_v128_load(b1 + k);
        v128_t w = wasm_v128_load(a0 + k);
        s00 = wasm_f32x4_add(s00, wasm_f32x4_mul(w, x0));
        s01 = wasm_f32x4_add(s01, wasm_f32x4_mul(w, x1));
        w = wasm_v128_load(a1 + k);
        s10 = wasm_f32x4_add(s10, wasm_f32x4_mul(w, x0));
        s11 = wasm_f32x4_add(s11, wasm_f32x4_mul(w, x1));
        w = wasm_v128_load(a2 + k);
        s20 = wasm_f32x4_add(s20, wasm_f32x4_mul(w, x0));
        s21 = wasm_f32x4_add(s21, wasm_f32x4_mul(w, x1));
        w = wasm_v128_load(a3 + k);
        s30 = wasm_f32x4_add(s30, wasm_f32x4_mul(w, x0));
        s31 = wasm_f32x4_add(s31, wasm_f32x4_mul(w, x1));
      }
      float r[8] = {hsum(s00), hsum(s01), hsum(s10), hsum(s11), hsum(s20), hsum(s21), hsum(s30), hsum(s31)};
      for (int k = K4; k < K; k++) {
        float x0 = b0[k], x1 = b1[k];
        r[0] += a0[k] * x0; r[1] += a0[k] * x1;
        r[2] += a1[k] * x0; r[3] += a1[k] * x1;
        r[4] += a2[k] * x0; r[5] += a2[k] * x1;
        r[6] += a3[k] * x0; r[7] += a3[k] * x1;
      }
      for (int i = 0; i < 4; i++) {
        for (int j = 0; j < 2; j++) {
          float v = r[i * 2 + j] + bias[m + i];
          out[(m + i) * ldo + n + j] = relu && v < 0 ? 0 : v;
        }
      }
    }
    for (; n < N; n++) {
      const float *b0 = B + n * K;
      for (int i = 0; i < 4; i++) {
        const float *a = A + (m + i) * K;
        float s = bias[m + i];
        for (int k = 0; k < K; k++) s += a[k] * b0[k];
        out[(m + i) * ldo + n] = relu && s < 0 ? 0 : s;
      }
    }
  }
  for (; m < M; m++) {
    const float *a = A + m * K;
    for (int n = 0; n < N; n++) {
      const float *b0 = B + n * K;
      v128_t acc = wasm_f32x4_splat(0);
      for (int k = 0; k < K4; k += 4) acc = wasm_f32x4_add(acc, wasm_f32x4_mul(wasm_v128_load(a + k), wasm_v128_load(b0 + k)));
      float s = hsum(acc) + bias[m];
      for (int k = K4; k < K; k++) s += a[k] * b0[k];
      out[m * ldo + n] = relu && s < 0 ? 0 : s;
    }
  }
}

/* cols[p][c*9 + ky*3 + kx] for a 3x3 kernel, padding 1. x: C x H x W. */
EXPORT(im2col3)
void im2col3(const float *x, float *cols, int c, int h, int w) {
  const int K = c * 9, P = h * w;
  for (int y = 0; y < h; y++) {
    for (int xx = 0; xx < w; xx++) {
      float *o = cols + (y * w + xx) * K;
      for (int i = 0; i < c; i++) {
        const float *ib = x + i * P;
        for (int ky = -1; ky <= 1; ky++) {
          int sy = y + ky;
          for (int kx = -1; kx <= 1; kx++) {
            int sx = xx + kx;
            *o++ = sy >= 0 && sy < h && sx >= 0 && sx < w ? ib[sy * w + sx] : 0.0f;
          }
        }
      }
    }
  }
}

EXPORT(maxpool)
void maxpool(const float *x, float *out, int c, int h, int w, int ph, int pw) {
  const int oh = h / ph, ow = w / pw;
  for (int ch = 0; ch < c; ch++) {
    for (int y = 0; y < oh; y++) {
      for (int xx = 0; xx < ow; xx++) {
        float m = -3.4e38f;
        for (int a = 0; a < ph; a++) {
          const float *row = x + ch * h * w + (y * ph + a) * w + xx * pw;
          for (int b = 0; b < pw; b++) if (row[b] > m) m = row[b];
        }
        out[ch * oh * ow + y * ow + xx] = m;
      }
    }
  }
}

/* x: C x W (H = 1) -> T = W steps of C features. */
EXPORT(transpose)
void transpose(const float *x, float *out, int rows, int cols) {
  for (int r = 0; r < rows; r++)
    for (int k = 0; k < cols; k++) out[k * rows + r] = x[r * cols + k];
}

static float expf_(float v) {
  /* exp via 2^(v*log2e): split integer/fraction, 6th-order polynomial. */
  if (v > 88.0f) v = 88.0f;
  if (v < -88.0f) v = -88.0f;
  float t = v * 1.44269504f;
  float fi = __builtin_floorf(t);
  float f = t - fi;
  float p = 1.0f + f * (0.693147181f + f * (0.240226507f + f * (0.0555041087f + f * (0.00961812911f + f * (0.00133335581f + f * 0.000154035304f)))));
  union { float f; int i; } u;
  u.i = ((int)fi + 127) << 23;
  return p * u.f;
}
static inline float sigmoid(float v) { return 1.0f / (1.0f + expf_(-v)); }
static inline float tanh_(float v) { return 2.0f / (1.0f + expf_(-2.0f * v)) - 1.0f; }

/*
 * One LSTM direction. pre: 4H x T, the input part W_ih . x_t + b already
 * computed for every step (one gemm_nt). Gates i, f, g, o (PyTorch order).
 * Writes h_t to out[t * ldo + off .. + H].
 */
EXPORT(lstm_dir)
void lstm_dir(const float *pre, int T, const float *whh, int H, int reverse, float *out, int ldo, int off, float *scratch) {
  float *h = scratch, *c = scratch + H, *g = scratch + 2 * H;
  for (int k = 0; k < H; k++) h[k] = c[k] = 0;
  const int H4 = H & ~3;
  for (int s = 0; s < T; s++) {
    const int t = reverse ? T - 1 - s : s;
    for (int r = 0; r < 4 * H; r++) {
      const float *w = whh + r * H;
      v128_t acc = wasm_f32x4_splat(0);
      for (int k = 0; k < H4; k += 4) acc = wasm_f32x4_add(acc, wasm_f32x4_mul(wasm_v128_load(w + k), wasm_v128_load(h + k)));
      float sum = hsum(acc) + pre[r * T + t];
      for (int k = H4; k < H; k++) sum += w[k] * h[k];
      g[r] = sum;
    }
    for (int k = 0; k < H; k++) {
      float ig = sigmoid(g[k]), fg = sigmoid(g[H + k]), gg = tanh_(g[2 * H + k]), og = sigmoid(g[3 * H + k]);
      c[k] = fg * c[k] + ig * gg;
      h[k] = og * tanh_(c[k]);
      out[t * ldo + off + k] = h[k];
    }
  }
}

/* ---------- detection: min/max filters on 8-bit images ---------- */

/* Running min/max over windows [i - a, i - a + k - 1] of one row, clipped to
 * the row (van Herk / Gil-Werman). pad: n + 2k bytes; pre/suf: n + k each. */
#define RUN_ROW(NAME, OP, ID)                                                              \
  static void NAME(const unsigned char *src, unsigned char *dst, int n, int k, int a,      \
                   unsigned char *pad, unsigned char *pre, unsigned char *suf) {           \
    const int m = n + k;                                                                   \
    for (int p = 0; p < m; p++) {                                                          \
      const int i = p - a;                                                                 \
      pad[p] = i >= 0 && i < n ? src[i] : ID;                                              \
    }                                                                                      \
    for (int b = 0; b < m; b += k) {                                                       \
      const int len = k < m - b ? k : m - b;                                               \
      unsigned char acc = ID;                                                              \
      for (int j = 0; j < len; j++) {                                                      \
        const unsigned char v = pad[b + j];                                                \
        acc = OP(acc, v);                                                                  \
        pre[b + j] = acc;                                                                  \
      }                                                                                    \
      acc = ID;                                                                            \
      for (int j = len - 1; j >= 0; j--) {                                                 \
        const unsigned char v = pad[b + j];                                                \
        acc = OP(acc, v);                                                                  \
        suf[b + j] = acc;                                                                  \
      }                                                                                    \
    }                                                                                      \
    for (int x = 0; x < n; x++) dst[x] = OP(suf[x], pre[x + k - 1]);                       \
  }
#define MAXU(a, b) ((a) > (b) ? (a) : (b))
#define MINU(a, b) ((a) < (b) ? (a) : (b))
RUN_ROW(run_row_max, MAXU, 0)
RUN_ROW(run_row_min, MINU, 255)

static inline v128_t pick(v128_t a, v128_t b, int max) { return max ? wasm_u8x16_max(a, b) : wasm_u8x16_min(a, b); }

/*
 * Separable kw x kh min (max = 0) or max filter, anchor at the centre, the
 * border ignored - OpenCV erode/dilate. Rows: van Herk per row. Columns: the
 * same running extremes, 16 columns at a time, row vectors as the unit.
 * scratch: morph_scratch(w, h, kw, kh) bytes.
 */
EXPORT(morph)
void morph(const unsigned char *src, unsigned char *dst, int w, int h, int kw, int kh, int max, unsigned char *scratch) {
  unsigned char *tmp = dst; /* rows pass result, then columns pass in place via blocks */
  unsigned char *pad = scratch, *pre = scratch + (w + kw), *suf = pre + (w + kw);
  for (int y = 0; y < h; y++) {
    if (max) run_row_max(src + y * w, tmp + y * w, w, kw, kw / 2, pad, pre, suf);
    else run_row_min(src + y * w, tmp + y * w, w, kw, kw / 2, pad, pre, suf);
  }

  /* Columns: padded rows p = 0 .. h + kh - 1 (row i = p - a), blocks of kh. */
  const int a = kh / 2, m = h + kh;
  const int w16 = (w + 15) & ~15;
  unsigned char *vpre = scratch + 3 * (w + kw);
  unsigned char *vsuf = vpre + m * w16;
  unsigned char *row = vsuf + m * w16; /* one padded row of w16 */
  const v128_t idv = wasm_u8x16_splat(max ? 0 : 255);
  for (int b = 0; b < m; b += kh) {
    const int len = kh < m - b ? kh : m - b;
    for (int x = 0; x < w16; x += 16) {
      v128_t acc = idv;
      for (int j = 0; j < len; j++) {
        int i = b + j - a;
        v128_t v;
        if (i >= 0 && i < h) {
          if (x + 16 <= w) v = wasm_v128_load(tmp + i * w + x);
          else {
            for (int q = 0; q < 16; q++) row[q] = x + q < w ? tmp[i * w + x + q] : (max ? 0 : 255);
            v = wasm_v128_load(row);
          }
        } else v = idv;
        acc = pick(acc, v, max);
        wasm_v128_store(vpre + (b + j) * w16 + x, acc);
      }
      acc = idv;
      for (int j = len - 1; j >= 0; j--) {
        int i = b + j - a;
        v128_t v;
        if (i >= 0 && i < h) {
          if (x + 16 <= w) v = wasm_v128_load(tmp + i * w + x);
          else {
            for (int q = 0; q < 16; q++) row[q] = x + q < w ? tmp[i * w + x + q] : (max ? 0 : 255);
            v = wasm_v128_load(row);
          }
        } else v = idv;
        acc = pick(acc, v, max);
        wasm_v128_store(vsuf + (b + j) * w16 + x, acc);
      }
    }
  }
  for (int y = 0; y < h; y++) {
    const unsigned char *u = vsuf + y * w16, *v = vpre + (y + kh - 1) * w16;
    int x = 0;
    for (; x + 16 <= w; x += 16) wasm_v128_store(dst + y * w + x, pick(wasm_v128_load(u + x), wasm_v128_load(v + x), max));
    for (; x < w; x++) dst[y * w + x] = max ? (u[x] > v[x] ? u[x] : v[x]) : (u[x] < v[x] ? u[x] : v[x]);
  }
}

EXPORT(morph_scratch)
int morph_scratch(int w, int h, int kw, int kh) {
  const int w16 = (w + 15) & ~15;
  return 3 * (w + kw) + 2 * (h + kh) * w16 + w16 + 64;
}

/* ---------- detection: resize, black-hat, threshold, components ---------- */

/*
 * cv2.resize of an 8-bit image: INTER_AREA to shrink (rows, then columns),
 * INTER_LINEAR to grow; result rounded and clamped to 8 bits.
 * tmp: (h + 1) * ow floats (area); 3 * ow words (linear).
 */
EXPORT(resize_u8)
void resize_u8(const unsigned char *src, int w, int h, unsigned char *dst, int ow, int oh, float *tmp) {
  if (ow > w || oh > h) {
    /* Per-column source pair and weight, then row by row. tmp: 2 * ow ints + ow floats. */
    int *cx0 = (int *)tmp, *cx1 = cx0 + ow;
    float *cax = (float *)(cx1 + ow);
    const float sx = (float)w / ow, sy = (float)h / oh;
    for (int x = 0; x < ow; x++) {
      float fx = (x + 0.5f) * sx - 0.5f;
      if (fx < 0) fx = 0;
      int x0 = (int)fx;
      if (x0 > w - 1) x0 = w - 1;
      cx0[x] = x0;
      cx1[x] = x0 + 1 < w ? x0 + 1 : w - 1;
      cax[x] = fx - x0;
    }
    for (int y = 0; y < oh; y++) {
      float fy = (y + 0.5f) * sy - 0.5f;
      if (fy < 0) fy = 0;
      int y0 = (int)fy;
      if (y0 > h - 1) y0 = h - 1;
      const int y1 = y0 + 1 < h ? y0 + 1 : h - 1;
      const float ay = fy - y0;
      const unsigned char *r0 = src + y0 * w, *r1 = src + y1 * w;
      unsigned char *o = dst + y * ow;
      for (int x = 0; x < ow; x++) {
        const float ax = cax[x];
        const float top = r0[cx0[x]] * (1 - ax) + r0[cx1[x]] * ax;
        const float bot = r1[cx0[x]] * (1 - ax) + r1[cx1[x]] * ax;
        const float v = top * (1 - ay) + bot * ay + 0.5f;
        o[x] = v <= 0 ? 0 : v >= 255 ? 255 : (unsigned char)v;
      }
    }
    return;
  }
  /* Rows: each of h rows, w -> ow, into tmp (h x ow). */
  const float s = (float)w / ow;
  for (int y = 0; y < h; y++) {
    const unsigned char *row = src + y * w;
    float *out = tmp + y * ow;
    for (int o = 0; o < ow; o++) {
      const float a = o * s, b = a + s;
      const int i0 = (int)a;
      int i1 = (int)__builtin_ceilf(b);
      if (i1 > w) i1 = w;
      float acc = 0;
      for (int i = i0; i < i1; i++) {
        const float lo = a > i ? a : i, hi = b < i + 1 ? b : i + 1;
        acc += (hi - lo) * row[i];
      }
      out[o] = acc / s;
    }
  }
  /* Columns: each of ow columns, h -> oh - a whole output row at a time. */
  float *acc = tmp + h * ow;
  const float t = (float)h / oh;
  const v128_t half = wasm_f32x4_splat(0.5f), lim = wasm_f32x4_splat(255.0f), zero = wasm_f32x4_splat(0);
  for (int o = 0; o < oh; o++) {
    const float a = o * t, b = a + t;
    const int i0 = (int)a;
    int i1 = (int)__builtin_ceilf(b);
    if (i1 > h) i1 = h;
    for (int x = 0; x < ow; x++) acc[x] = 0;
    for (int i = i0; i < i1; i++) {
      const float lo = a > i ? a : i, hi = b < i + 1 ? b : i + 1;
      const float wgt = hi - lo;
      const float *r = tmp + i * ow;
      const v128_t wv = wasm_f32x4_splat(wgt);
      int x = 0;
      for (; x + 4 <= ow; x += 4) wasm_v128_store(acc + x, wasm_f32x4_add(wasm_v128_load(acc + x), wasm_f32x4_mul(wv, wasm_v128_load(r + x))));
      for (; x < ow; x++) acc[x] += wgt * r[x];
    }
    unsigned char *out = dst + o * ow;
    const v128_t tv = wasm_f32x4_splat(t);
    int x = 0;
    for (; x + 4 <= ow; x += 4) {
      v128_t v = wasm_f32x4_add(wasm_f32x4_div(wasm_v128_load(acc + x), tv), half);
      v = wasm_f32x4_min(wasm_f32x4_max(v, zero), lim);
      v128_t iv = wasm_i32x4_trunc_sat_f32x4(v);
      out[x] = (unsigned char)wasm_i32x4_extract_lane(iv, 0);
      out[x + 1] = (unsigned char)wasm_i32x4_extract_lane(iv, 1);
      out[x + 2] = (unsigned char)wasm_i32x4_extract_lane(iv, 2);
      out[x + 3] = (unsigned char)wasm_i32x4_extract_lane(iv, 3);
    }
    for (; x < ow; x++) {
      const float v = acc[x] / t + 0.5f;
      out[x] = v <= 0 ? 0 : v >= 255 ? 255 : (unsigned char)v;
    }
  }
}

/* OpenCV's Otsu threshold value (getThreshVal_Otsu_8u), in doubles as detect.ts. */
static int otsu(const unsigned char *src, int n) {
  double hist[256] = {0};
  for (int i = 0; i < n; i++) hist[src[i]]++;
  double mu = 0;
  for (int i = 0; i < 256; i++) mu += i * hist[i];
  mu /= n;
  double q1 = 0, mu1 = 0, maxVal = 0;
  int best = 0;
  for (int i = 0; i < 256; i++) {
    const double p = hist[i] / n;
    const double q2 = 1 - q1 - p;
    const double q1n = q1 + p;
    const double mn = q1n < q2 ? q1n : q2, mx = q1n > q2 ? q1n : q2;
    if (mn < 1e-7 || mx > 1 - 1e-7) {
      mu1 = q1n > 0 ? (mu1 * q1 + i * p) / q1n : 0;
      q1 = q1n;
      continue;
    }
    mu1 = (mu1 * q1 + i * p) / q1n;
    q1 = q1n;
    const double mu2 = (mu - q1 * mu1) / q2;
    const double sigma = q1 * q2 * (mu1 - mu2) * (mu1 - mu2);
    if (sigma > maxVal) {
      maxVal = sigma;
      best = i;
    }
  }
  return best;
}

static int find(int *parent, int a) {
  while (parent[a] != a) a = parent[a] = parent[parent[a]];
  return a;
}

/*
 * detect.ts bars() up to the connected components: black-hat (close k x k
 * minus the image), Otsu (at least 12), horizontal close kx x 3, then
 * 8-connected components. Returns a pointer to ints:
 *   [n, pixels[n], rowStart[n + 1], then (y, xFirst, xLast) per component row]
 * with each component's rows in increasing y. Allocated here; the caller
 * releases it with heap_reset.
 */
EXPORT(bar_pixels)
int *bar_pixels(const unsigned char *g, int w, int h, int k, int kx) {
  const int n = w * h;
  int sk = morph_scratch(w, h, k, k), sx = morph_scratch(w, h, kx, 3);
  unsigned char *scratch = (unsigned char *)alloc(sk > sx ? sk : sx);
  unsigned char *a = (unsigned char *)alloc(n), *b = (unsigned char *)alloc(n);
  morph(g, a, w, h, k, k, 1, scratch);
  morph(a, b, w, h, k, k, 0, scratch); /* b = closed */
  for (int i = 0; i < n; i++) a[i] = b[i] > g[i] ? b[i] - g[i] : 0; /* a = black-hat */
  int t = otsu(a, n);
  if (t < 12) t = 12;
  for (int i = 0; i < n; i++) b[i] = a[i] > t ? 255 : 0;
  morph(b, a, w, h, kx, 3, 1, scratch);
  morph(a, b, w, h, kx, 3, 0, scratch); /* b = bars, binary */

  int *label = (int *)alloc(n * 4), *parent = (int *)alloc(n * 4);
  int np = 0;
  for (int y = 0; y < h; y++) {
    for (int x = 0; x < w; x++) {
      const int i = y * w + x;
      if (!b[i]) {
        label[i] = -1;
        continue;
      }
      int l = -1;
      const int nb[4] = {x > 0 ? i - 1 : -1, y > 0 && x > 0 ? i - w - 1 : -1, y > 0 ? i - w : -1, y > 0 && x < w - 1 ? i - w + 1 : -1};
      for (int q = 0; q < 4; q++) {
        const int j = nb[q];
        if (j < 0 || label[j] < 0) continue;
        const int r = find(parent, label[j]);
        if (l < 0) l = r;
        else if (r != l) {
          const int lo = r < l ? r : l, hi = r < l ? l : r;
          parent[hi] = lo;
          l = lo;
        }
      }
      if (l < 0) {
        l = np;
        parent[np] = np;
        np++;
      }
      label[i] = l;
    }
  }
  /* Compact ids; pixels and distinct rows per component. */
  int *cid = (int *)alloc((np + 1) * 4);
  for (int q = 0; q < np; q++) cid[q] = -1;
  int nc = 0;
  for (int i = 0; i < n; i++) {
    if (label[i] < 0) continue;
    const int r = find(parent, label[i]);
    if (cid[r] < 0) cid[r] = nc++;
    label[i] = cid[r];
  }
  int *res = (int *)alloc((1 + nc + nc + 1) * 4);
  int *pixels = res + 1, *start = res + 1 + nc;
  int *lastY = (int *)alloc((nc + 1) * 4);
  for (int c = 0; c < nc; c++) pixels[c] = 0, start[c] = 0, lastY[c] = -1;
  for (int y = 0; y < h; y++)
    for (int x = 0; x < w; x++) {
      const int c = label[y * w + x];
      if (c < 0) continue;
      pixels[c]++;
      if (lastY[c] != y) lastY[c] = y, start[c]++;
    }
  int total = 0;
  for (int c = 0; c < nc; c++) {
    const int rows = start[c];
    start[c] = total;
    total += rows;
  }
  start[nc] = total;
  int *rows = (int *)alloc(total * 12 + 4); /* follows res in memory */
  int *fill = (int *)alloc((nc + 1) * 4);
  for (int c = 0; c < nc; c++) fill[c] = start[c] - 1, lastY[c] = -1;
  for (int y = 0; y < h; y++)
    for (int x = 0; x < w; x++) {
      const int c = label[y * w + x];
      if (c < 0) continue;
      if (lastY[c] != y) {
        lastY[c] = y;
        const int e = ++fill[c];
        rows[e * 3] = y, rows[e * 3 + 1] = x, rows[e * 3 + 2] = x;
      } else rows[fill[c] * 3 + 2] = x;
    }
  res[0] = nc;
  /* Hand back one block: header then rows, contiguous for the caller. */
  int *out = (int *)alloc((1 + 2 * nc + 1 + total * 3) * 4);
  for (int q = 0; q < 1 + 2 * nc + 1; q++) out[q] = res[q];
  for (int q = 0; q < total * 3; q++) out[1 + 2 * nc + 1 + q] = rows[q];
  return out;
}
