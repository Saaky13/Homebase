import { type SkImage } from '@shopify/react-native-skia';

import {
  getCat,
  getCatGrid,
  PALETTES,
  type Direction,
} from '../constants/catSprites';
import { rasteriseGrid } from './pixelImage';

/**
 * Rasterises a procedural cat into an SkImage the café can draw.
 *
 * Each cat/direction is rendered once through `rasteriseGrid` and the snapshot
 * is reused forever; eight directions across the handful of cats a player owns
 * is trivial memory.
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

  return rasteriseGrid(getCatGrid(spec, direction), PALETTES[spec.palette]);
}

/** Sprite proportions, so callers can scale without squashing. */
export function catAspectRatio(catId: string): number {
  const spec = getCat(catId);
  if (!spec) return 1;
  const grid = getCatGrid(spec, 'front');
  const width = grid[0]?.length ?? 1;
  return grid.length / width;
}
