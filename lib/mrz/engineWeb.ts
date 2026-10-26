/**
 * Entry point of the MRZ engine inside a hidden WebView (bundled into
 * engineHtml.ts by scripts/build-mrz-engine.sh). The WebView's engine has a
 * JIT, which the app's Hermes does not - the recognizer is several times
 * faster here - and it decodes the camera JPEG natively, EXIF rotation
 * applied.
 *
 * Messages in: {type: 'read', id, jpeg: <base64>}. Out: {type: 'ready'},
 * {type: 'result', id, lines, reason, ms}, {type: 'error', id, message}.
 */

import { readMrz, warmUp } from './engine';
import { toGray } from './detect';

const MAX_SIDE = 1600;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const w = globalThis as any;

const post = (msg: object) => w.ReactNativeWebView.postMessage(JSON.stringify(msg));

async function handle(raw: unknown) {
  let msg: { type?: string; id?: number; jpeg?: string };
  try {
    msg = JSON.parse(String(raw));
  } catch {
    return;
  }
  if (msg.type !== 'read') return;
  try {
    const img = new w.Image();
    img.src = 'data:image/jpeg;base64,' + msg.jpeg;
    await img.decode();
    // Large camera photos are scaled down by the browser - far quicker than in JS.
    const s = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const cw = Math.round(img.naturalWidth * s);
    const ch = Math.round(img.naturalHeight * s);
    const canvas = w.document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, cw, ch);
    const r = readMrz(toGray(ctx.getImageData(0, 0, cw, ch).data, cw, ch));
    post({ type: 'result', id: msg.id, ...r });
  } catch (e) {
    post({ type: 'error', id: msg.id, message: String(e) });
  }
}

w.document.addEventListener('message', (e: { data: unknown }) => handle(e.data)); // Android
w.addEventListener('message', (e: { data: unknown }) => handle(e.data)); // iOS
setTimeout(() => {
  warmUp();
  post({ type: 'ready' });
}, 0);
