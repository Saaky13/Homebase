/**
 * Skia implementation of Painter — the native path.
 *
 * Mirrors createCanvasPainter exactly, so the town's drawing code is unaware
 * of which backend it is talking to. On iOS and Android there is no <canvas>,
 * so this is the only way the town renders at all.
 */

import { PaintStyle, Skia, type SkCanvas } from '@shopify/react-native-skia';

import { Painter } from './draw';

export function createSkiaPainter(canvas: SkCanvas): Painter {
  // The town is pixel art: one Paint is reused across thousands of rects
  // rather than allocated per call.
  const paint = Skia.Paint();
  paint.setStyle(PaintStyle.Fill);
  // Off, so tile edges stay crisp instead of blurring into each other —
  // the web path gets the same effect from imageSmoothingEnabled = false.
  paint.setAntiAlias(false);

  return {
    rect(x, y, w, h, color) {
      if (w <= 0 || h <= 0) return;
      paint.setColor(Skia.Color(color));
      canvas.drawRect(Skia.XYWHRect(x, y, w, h), paint);
    },
  };
}
