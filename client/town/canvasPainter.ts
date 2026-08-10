/**
 * Canvas2D implementation of Painter — the web path.
 *
 * The Skia equivalent is the same shape: hold a canvas and a reusable Paint,
 * and implement `rect` as `canvas.drawRect(Skia.XYWHRect(...), paint)`. Nothing
 * else in the town needs to know which one it is talking to.
 */

import { Painter } from './draw';

export function createCanvasPainter(ctx: CanvasRenderingContext2D): Painter {
  return {
    rect(x, y, w, h, color) {
      if (w <= 0 || h <= 0) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    },
  };
}
