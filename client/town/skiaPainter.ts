/**
 * Skia implementation of Painter — the native path.
 *
 * Mirrors createCanvasPainter exactly, so the town's drawing code never learns
 * which backend it is talking to. There is no <canvas> on iOS or Android, so
 * without this the home screen paints nothing at all.
 */

import { PaintStyle, Skia, type SkCanvas } from '@shopify/react-native-skia';

import { Painter } from './draw';

export function createSkiaPainter(canvas: SkCanvas): Painter {
  // The town is thousands of one-pixel rects; one Paint is reused across all
  // of them rather than allocated per call.
  const paint = Skia.Paint();
  paint.setStyle(PaintStyle.Fill);
  // Off, so tile edges stay crisp instead of bleeding into each other — the
  // web path gets the same result from imageSmoothingEnabled = false.
  paint.setAntiAlias(false);

  return {
    rect(x, y, w, h, color) {
      if (w <= 0 || h <= 0) return;
      paint.setColor(Skia.Color(color));
      canvas.drawRect(Skia.XYWHRect(x, y, w, h), paint);
    },
  };
}
