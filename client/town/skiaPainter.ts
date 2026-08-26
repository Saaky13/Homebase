/**
 * Skia implementation of Painter — the native path.
 *
 * The web equivalent is `canvasPainter.ts`. Both implement the same `Painter`
 * interface from `draw.ts`, so the town drawing code (`drawTown`, `drawRoamers`)
 * runs unchanged on either platform.
 *
 * One Paint is kept and mutated per draw call — no allocation per rect, which
 * matters because the town is a few thousand rects per frame.
 *
 * Color strings arrive as hex (#rrggbb) from the palette. `Skia.Color` parses
 * them correctly and caches nothing, so we cache the mapping ourselves. The
 * town uses ~60 distinct colors; each re-used color skips the parse entirely.
 */

import { Skia, type SkCanvas, type SkColor } from '@shopify/react-native-skia';
import type { Painter } from './draw';

// SkColor is a Float32Array — expensive to parse from hex each call, and the
// town reuses ~60 distinct colours across thousands of rects per frame.
const COLOR_CACHE = new Map<string, SkColor>();

function skColor(hex: string): SkColor {
  let c = COLOR_CACHE.get(hex);
  if (c === undefined) {
    c = Skia.Color(hex);
    COLOR_CACHE.set(hex, c);
  }
  return c;
}

export function createSkiaPainter(canvas: SkCanvas): Painter {
  const paint = Skia.Paint();
  return {
    rect(x, y, w, h, color) {
      if (w <= 0 || h <= 0) return;
      paint.setColor(skColor(color));
      canvas.drawRect(Skia.XYWHRect(x, y, w, h), paint);
    },
  };
}
