import { Skia, type SkImage } from '@shopify/react-native-skia';

import {
  getCat,
  getCatGrid,
  PALETTES,
  type Direction,
} from '../constants/catSprites';

/**
 * Rasterises a procedural cat into an SkImage the café can draw.
 *
 * The café floor runs a requestAnimationFrame loop over a Skia canvas, and a
 * cat grid is 28x37 — a thousand cells. Painting those as individual rects
 * every frame, for up to thirteen cats, is not viable. Each cat/direction is
 * drawn once into an offscreen surface and the snapshot is reused forever;
 * eight directions across the handful of cats a player owns is trivial memory.
 */

const cache = new Map<string, SkImage | null>();

export function getCatSkImage(catId: string, direction: Direction): SkImage | null {
  const key = `${catId}:${direction}`;

  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const image = rasterise(catId, direction);
  cache.set(key, image);
  return image;
}

function rasterise(catId: string, direction: Direction): SkImage | null {
  const spec = getCat(catId);
  if (!spec) return null;

  const grid = getCatGrid(spec, direction);
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (!width || !height) return null;

  // Drawn at the sprite's own pixel size; the café scales it up at draw time.
  const surface = Skia.Surface.Make(width, height);
  if (!surface) return null;

  const canvas = surface.getCanvas();
  const palette = PALETTES[spec.palette];
  const paint = Skia.Paint();
  paint.setAntiAlias(false);

  for (let y = 0; y < height; y++) {
    const row = grid[y];
    // Runs of one colour become a single rect, the same trick utils/pixelSvg
    // uses — large flat areas of coat collapse to a few dozen draws.
    let runStart = -1;
    let runColor: string | undefined;

    for (let x = 0; x <= row.length; x++) {
      const cellKey = x < row.length ? row[x] : undefined;
      const color = cellKey && cellKey !== '.' ? palette[cellKey] : undefined;

      if (color === runColor && runStart !== -1) continue;

      if (runStart !== -1 && runColor) {
        paint.setColor(Skia.Color(runColor));
        canvas.drawRect(Skia.XYWHRect(runStart, y, x - runStart, 1), paint);
      }

      runStart = color ? x : -1;
      runColor = color;
    }
  }

  return surface.makeImageSnapshot();
}

/** Sprite proportions, so callers can scale without squashing. */
export function catAspectRatio(catId: string): number {
  const spec = getCat(catId);
  if (!spec) return 1;
  const grid = getCatGrid(spec, 'front');
  const width = grid[0]?.length ?? 1;
  return grid.length / width;
}
