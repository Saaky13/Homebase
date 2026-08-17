/**
 * The café's pixel painter.
 *
 * Everything in the café is now a filled axis-aligned rectangle, the same rule
 * `town/draw.ts` follows. No curves, no gradients, no antialiased gloss — that
 * mismatch is what made the café look like it belonged to a different game than
 * the pixel cats standing in it.
 *
 * `PX` is the size of one art pixel in the café's 390x844 design space. At 2
 * it lands within a fifth of a pixel of the cat sprites' own density (a 28-wide
 * grid drawn 47px wide), so floor and cats read at the same resolution. Going
 * finer starts to shimmer once the design space is scaled to the device.
 */

import type { Ctx2D } from './skiaCanvas2d';

export const PX = 2;

/** Snap a design-space coordinate onto the art grid. */
export const snap = (v: number) => Math.round(v / PX) * PX;

export class PixelPainter {
  private ctx: Ctx2D;

  constructor(ctx: Ctx2D) {
    this.ctx = ctx;
  }

  /**
   * The one primitive. Coordinates arrive in design space and are snapped, so
   * callers can think in ordinary units and still land on the grid.
   */
  rect(x: number, y: number, w: number, h: number, color: string) {
    const x0 = snap(x);
    const y0 = snap(y);
    const x1 = snap(x + w);
    const y1 = snap(y + h);
    if (x1 <= x0 || y1 <= y0) return;

    this.ctx.fillStyle = color;
    this.ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  /**
   * A filled ellipse rasterised one scanline per art pixel — a proper pixel
   * circle with stepped edges, not a smooth one. Round tabletops and cushions
   * are the only curved things left in the café and this is how they stay
   * on-grid.
   */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: string) {
    if (rx <= 0 || ry <= 0) return;

    for (let y = -ry; y < ry; y += PX) {
      // Sample the row's midpoint so the top and bottom rows aren't hairlines.
      const t = (y + PX / 2) / ry;
      if (Math.abs(t) >= 1) continue;
      const halfWidth = rx * Math.sqrt(1 - t * t);
      if (halfWidth < PX / 2) continue;
      this.rect(cx - halfWidth, cy + y, halfWidth * 2, PX, color);
    }
  }

  /** An ellipse outline: the filled shape minus an inset copy. */
  ellipseRing(cx: number, cy: number, rx: number, ry: number, thickness: number, color: string) {
    for (let y = -ry; y < ry; y += PX) {
      const t = (y + PX / 2) / ry;
      if (Math.abs(t) >= 1) continue;
      const outer = rx * Math.sqrt(1 - t * t);

      const iy = ry - thickness;
      const ix = rx - thickness;
      const ti = (y + PX / 2) / iy;
      const inner = Math.abs(ti) < 1 ? ix * Math.sqrt(1 - ti * ti) : 0;

      if (inner <= 0) {
        this.rect(cx - outer, cy + y, outer * 2, PX, color);
        continue;
      }
      this.rect(cx - outer, cy + y, outer - inner, PX, color);
      this.rect(cx + inner, cy + y, outer - inner, PX, color);
    }
  }

  /** Rect with the four corner pixels dropped — the pixel-art way to round. */
  softRect(x: number, y: number, w: number, h: number, color: string, bite = PX) {
    this.rect(x + bite, y, w - bite * 2, h, color);
    this.rect(x, y + bite, w, h - bite * 2, color);
  }

  /** Outline of a soft rect, drawn as four edges so the interior stays clear. */
  softRectEdge(x: number, y: number, w: number, h: number, t: number, color: string) {
    this.rect(x + t, y, w - t * 2, t, color);
    this.rect(x + t, y + h - t, w - t * 2, t, color);
    this.rect(x, y + t, t, h - t * 2, color);
    this.rect(x + w - t, y + t, t, h - t * 2, color);
  }
}

/**
 * Deterministic value noise, seeded on position. Floorboards, plank grain and
 * wall speckle all need variation that stays put between frames — `Math.random`
 * would make the whole room crawl at 60fps.
 */
export function noise(x: number, y: number, salt = 0): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}
