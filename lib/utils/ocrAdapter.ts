/**
 * Adapter between `react-native-vision-camera-ocr-plus`'s native OCR result
 * shape and the local `TextBlock[]` shape that `mrz.ts` and
 * `idCardTemplate.ts` are written against.
 *
 * Those two files used to import `TextBlock`/`Frame` directly from
 * `@react-native-ml-kit/text-recognition` (the package used by the old
 * takePictureAsync-then-OCR loop). That package is no longer a dependency —
 * scan-id.tsx now runs OCR live, frame-by-frame, via VisionCamera +
 * react-native-vision-camera-ocr-plus. Rather than rewrite mrz.ts/
 * idCardTemplate.ts's parsing/geometry logic against the new plugin's own
 * (differently-shaped, differently-named) result type, this file defines a
 * local, minimal `TextBlock`/`Frame` type — structurally identical to what
 * those two files already consume — and a pure function that maps the new
 * plugin's real result into it. mrz.ts/idCardTemplate.ts now import their
 * `TextBlock`/`Frame` types from here instead; nothing else about them
 * changed.
 */
import type { BlockData, ElementData, FrameType, LineData, Text as OcrPlusText } from 'react-native-vision-camera-ocr-plus';

/** Pixel-unit bounding box, top-left origin — same shape mrz.ts/idCardTemplate.ts's geometry math (findMrzLinesFromBlocks, isSameRowToRight, isStackedBelow) assumes. */
export type Frame = {
  width: number;
  height: number;
  top: number;
  left: number;
};

export type TextElement = {
  text: string;
  frame?: Frame;
};

export type TextLine = {
  text: string;
  frame?: Frame;
  elements: TextElement[];
};

export type TextBlock = {
  text: string;
  frame?: Frame;
  lines: TextLine[];
};

/**
 * react-native-vision-camera-ocr-plus's `BlockData`/`LineData`/`ElementData`
 * each carry a `*Frame: FrameType` with `{ boundingCenterX, boundingCenterY,
 * width, height, x, y }`. It's tempting to map `x`/`y` straight to
 * `left`/`top`, but don't — they are NOT the box's top-left corner.
 *
 * Working through the plugin's own native construction (both
 * android/.../HybridTextRecognizer.kt's `boundingFrame()` and
 * ios/HybridTextRecognizer.swift's `boundingFrame(from:)` build `x`/`y` from
 * the same lopsided `center ± (center - ceil(size)) / 2` formula rather than
 * a plain rect corner) shows `x`/`y` do not reduce to `left`/`top` for any
 * rect — e.g. for a 100×50 box at origin (0,0), the plugin's own formula
 * yields `x = 25`, `y = -12.5`, neither of which is the actual left (0) or
 * top (0). Whatever `x`/`y` are meant to represent, they are not usable as
 * a rect corner.
 *
 * `boundingCenterX`/`boundingCenterY` + `width`/`height` are unambiguous
 * and standard, though, and trivially invert to the real top-left corner:
 * `left = centerX - width / 2`, `top = centerY - height / 2` — verified
 * against the same worked example above (centerX=50, width=100 → left=0,
 * matching the true rect). That's what this adapter uses; `x`/`y` are
 * intentionally ignored.
 */
function frameFromBoundingFrame(bf: FrameType): Frame {
  return {
    width: bf.width,
    height: bf.height,
    left: bf.boundingCenterX - bf.width / 2,
    top: bf.boundingCenterY - bf.height / 2,
  };
}

function adaptElement(e: ElementData): TextElement {
  return {
    text: e.elementText,
    frame: frameFromBoundingFrame(e.elementFrame),
  };
}

function adaptLine(l: LineData): TextLine {
  return {
    text: l.lineText,
    frame: frameFromBoundingFrame(l.lineFrame),
    elements: l.elements.map(adaptElement),
  };
}

function adaptBlock(b: BlockData): TextBlock {
  return {
    text: b.blockText,
    frame: frameFromBoundingFrame(b.blockFrame),
    lines: b.lines.map(adaptLine),
  };
}

/** Maps a live-frame OCR result from react-native-vision-camera-ocr-plus into the local `TextBlock[]` shape mrz.ts/idCardTemplate.ts expect. */
export function adaptOcrPlusResult(result: OcrPlusText): TextBlock[] {
  return result.blocks.map(adaptBlock);
}
