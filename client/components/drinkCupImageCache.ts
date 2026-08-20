import { type SkImage } from '@shopify/react-native-skia';

import { CUP_PALETTES, DRINKS, type DrinkId } from '../constants/drinks';
import { vesselGrid, type Vessel } from '../constants/vessels';
import { rasteriseGrid } from './pixelImage';

/**
 * The cup a served cat carries, for any recipe on the menu — not just boba.
 *
 * Mirrors `bobaImageCache.ts`'s shape exactly, keyed by `DrinkId` instead of
 * `BobaFlavor`: a cat sips its way down four levels over the minute it's
 * seated, so `DrinkId` count x 4 images covers every cup that will ever be on
 * the floor. All three vessels share one 20x30 grid box (`vessels.ts`), so one
 * cache serves boba, coffee and tea alike.
 */

/** How full the cup is at each step, from just-served to nearly gone. */
const LEVELS = [1, 0.66, 0.34, 0.1];

export const DRINK_CUP_STEPS = LEVELS.length;

const imageCache = new Map<string, SkImage | null>();

export function getDrinkCupSkImage(drink: DrinkId, step: number): SkImage | null {
  const clamped = Math.max(0, Math.min(LEVELS.length - 1, Math.floor(step)));
  const key = `${drink}:${clamped}`;

  const cached = imageCache.get(key);
  if (cached !== undefined) return cached;

  const vessel = DRINKS[drink].vessel;
  const image = rasteriseGrid(vesselGrid(vessel, LEVELS[clamped]), CUP_PALETTES[drink]);
  imageCache.set(key, image);
  return image;
}

/** Every vessel is drawn in the same 20x30 box, so the aspect is constant —
 *  kept as a lookup (rather than a bare constant) so a future vessel with its
 *  own grid size doesn't have to touch every call site. */
const aspectCache = new Map<Vessel, number>();

export function drinkCupAspect(drink: DrinkId): number {
  const vessel = DRINKS[drink].vessel;
  const cached = aspectCache.get(vessel);
  if (cached !== undefined) return cached;

  const grid = vesselGrid(vessel, 1);
  const aspect = grid.length / (grid[0]?.length ?? 1);
  aspectCache.set(vessel, aspect);
  return aspect;
}
