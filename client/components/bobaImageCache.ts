import { type SkImage } from '@shopify/react-native-skia';

import { BOBA_PALETTE, bobaCupGrid, type BobaFlavor } from '../constants/bobaCup';
import { rasteriseGrid } from './pixelImage';

/**
 * The little cup a served cat carries.
 *
 * Cached per flavour and fill step rather than per exact fill: a cat sips its
 * way down four levels over the minute it's sitting, so twelve images cover
 * every cup that will ever be on the floor.
 */

/** How full the cup is at each step, from just-served to nearly gone. */
const LEVELS = [1, 0.66, 0.34, 0.1];

export const DRINK_STEPS = LEVELS.length;

const cache = new Map<string, SkImage | null>();

export function getBobaCupSkImage(flavor: BobaFlavor, step: number): SkImage | null {
  const clamped = Math.max(0, Math.min(LEVELS.length - 1, Math.floor(step)));
  const key = `${flavor}:${clamped}`;

  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const image = rasteriseGrid(bobaCupGrid(LEVELS[clamped]), BOBA_PALETTE[flavor]);
  cache.set(key, image);
  return image;
}

/** Cup proportions, so callers can scale without squashing. */
export const CUP_GRID_ASPECT = (() => {
  const grid = bobaCupGrid(1);
  return grid.length / (grid[0]?.length ?? 1);
})();
